import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { callModel } from "@/features/model-call/call-model";
import { failure } from "@/features/model-call/failures";
import {
  describeDecisionForLog,
  promptInjectionWentUnchecked,
  toProtectionOutcome,
  unevaluatedRules,
} from "@/features/model-call/protection";
import { parseModelCallRequest } from "@/features/model-call/request";
import { toEventStreamResponse, toRefusalResponse } from "@/features/model-call/stream-response";
import { conversationFor } from "@/features/thread/conversation";
import { findThread, findTurnOwner } from "@/features/thread/queries";
import { recordAndTrack } from "@/features/thread/record-call";
import { ajModelCall, TOKENS_PER_MODEL_CALL } from "@/lib/arcjet";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * One model per request, on purpose.
 *
 * Three models answering means three calls to this route, each with its own
 * connection and its own abort signal, so one failing or hanging is invisible
 * to the other two. Nothing here is ever multiplexed.
 *
 * The body is two ids. The conversation is assembled here, from the stored
 * thread, rather than being sent by the browser — the server already holds
 * every prompt and every answer, and a history arriving from the client would
 * be a forgeable second copy of it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseModelCallRequest(body);

  if (!parsed.ok) {
    return Response.json({ error: parsed.reason }, { status: 400 });
  }

  // Sending a prompt costs real model calls against a shared budget, so it
  // needs an account. Reading a thread deliberately does not — that is what
  // makes a thread shareable — which is why this check lives here rather than
  // in the proxy.
  const { userId } = await auth();

  if (userId === null) {
    return toRefusalResponse({ type: "error", failure: failure("sign-in-required") }, 401);
  }

  // Clerk's id, not the PostHog cookie, so a person's events and their rate
  // limit refer to the same someone across devices and sessions.
  const distinctId = userId;

  // The cheap checks first, before anything is spent: does this turn exist, is
  // it this person's, and is this model actually in the thread's line-up. That
  // last one is where the locked line-up is really enforced — the composer
  // stops offering the control, this refuses the request.
  const owner = await findTurnOwner(parsed.request.turnId);

  if (owner?.ownerId !== userId) {
    console.warn(
      `[model-call] refused turn=${parsed.request.turnId} reason=${owner === null ? "no-such-turn" : "not-owner"}`,
    );
    return toRefusalResponse({ type: "error", failure: failure("blocked") }, 403);
  }

  const thread = await findThread(owner.threadId);

  if (thread?.modelIds.includes(parsed.request.modelId) !== true) {
    console.warn(
      `[model-call] refused turn=${parsed.request.turnId} model=${parsed.request.modelId} reason=not-in-lineup`,
    );
    return toRefusalResponse({ type: "error", failure: failure("blocked") }, 403);
  }

  // Arcjet runs before anything reaches OpenRouter: shield, bot detection, and
  // one token off this person's bucket for this single model call. Prompt
  // screening already happened once, where the prompt was submitted.
  const decision = await ajModelCall.protect(request, {
    userId,
    requested: TOKENS_PER_MODEL_CALL,
  });

  // Any rule that could not be evaluated failed open, meaning the request
  // proceeds as though it had passed. That is deliberate, but it must never be
  // invisible: without this, screening could silently stop happening while the
  // app looked perfectly healthy. Tracked so coverage is a number we can read.
  const unevaluated = unevaluatedRules(decision);

  if (unevaluated.length > 0) {
    console.warn(
      `[arcjet] failed open, rules not evaluated: ${unevaluated.join(", ")} id=${decision.id}`,
    );
    getPostHogClient()?.capture({
      distinctId,
      event: "arcjet_failed_open",
      properties: {
        model_id: parsed.request.modelId,
        unevaluated_rules: unevaluated,
        prompt_injection_unchecked: promptInjectionWentUnchecked(decision),
        arcjet_decision_id: decision.id,
      },
    });
  }

  const outcome = toProtectionOutcome(decision);

  if (!outcome.allowed) {
    console.warn(`[arcjet] denied ${describeDecisionForLog(decision)}`);
    getPostHogClient()?.capture({
      distinctId,
      event: "model_call_denied",
      properties: {
        model_id: parsed.request.modelId,
        failure_kind: outcome.failure.kind,
        arcjet_reason: decision.reason.type,
      },
    });
    // No `ModelResponse` row: a row records what happened to a model call, and
    // this call never happened. The consequence is written down in scope —
    // re-opening the thread shows that model simply absent from the turn.
    return toRefusalResponse({ type: "error", failure: outcome.failure }, outcome.status);
  }

  return toEventStreamResponse(
    recordAndTrack(
      callModel(
        {
          modelId: parsed.request.modelId,
          messages: conversationFor(thread, parsed.request.modelId),
        },
        request.signal,
      ),
      { turnId: parsed.request.turnId, modelId: parsed.request.modelId, distinctId },
    ),
  );
}
