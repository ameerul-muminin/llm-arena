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
import {
  toEventStreamResponse,
  toRefusalResponse,
} from "@/features/model-call/stream-response";
import type { ModelCallEvent } from "@/features/model-call/types";
import { aj, TOKENS_PER_MODEL_CALL } from "@/lib/arcjet";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * One model per request, on purpose.
 *
 * Three models answering means three calls to this route, each with its own
 * connection and its own abort signal, so one failing or hanging is invisible
 * to the other two. Nothing here is ever multiplexed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wraps the model call generator to capture server-side PostHog events
 * for completion and failure without buffering the full response.
 */
async function* withPostHogTracking(
  events: AsyncGenerator<ModelCallEvent, void>,
  modelId: string,
  distinctId: string,
): AsyncGenerator<ModelCallEvent, void> {
  const posthog = getPostHogClient();
  for await (const event of events) {
    yield event;
    if (event.type === "done" && posthog) {
      posthog.capture({
        distinctId,
        event: "server_model_call_completed",
        properties: {
          model_id: modelId,
          total_ms: event.metrics.totalMs,
          input_tokens: event.metrics.inputTokens,
          output_tokens: event.metrics.outputTokens,
          total_tokens: event.metrics.totalTokens,
          reasoning_tokens: event.metrics.reasoningTokens,
          text_tokens: event.metrics.textTokens,
          tokens_per_second: event.metrics.tokensPerSecond,
          end_to_end_tokens_per_second: event.metrics.endToEndTokensPerSecond,
          streamed: event.metrics.streamed,
          delta_count: event.metrics.deltaCount,
        },
      });
      await posthog.flush();
    } else if (event.type === "error" && posthog) {
      posthog.capture({
        distinctId,
        event: "server_model_call_failed",
        properties: {
          model_id: modelId,
          failure_kind: event.failure.kind,
          retryable: event.failure.retryable,
        },
      });
      await posthog.flush();
    }
  }
}

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

  // Arcjet runs before anything reaches OpenRouter: shield, bot detection,
  // prompt-injection detection on the newest user message, and one token off
  // this user's bucket for this single model call. A denied request never
  // costs us a provider call.
  const latestUserMessage =
    [...parsed.request.messages].reverse().find((message) => message.role === "user")?.content ??
    "";

  const decision = await aj.protect(request, {
    userId,
    requested: TOKENS_PER_MODEL_CALL,
    detectPromptInjectionMessage: latestUserMessage,
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
    return toRefusalResponse({ type: "error", failure: outcome.failure }, outcome.status);
  }

  return toEventStreamResponse(
    withPostHogTracking(
      callModel(parsed.request, request.signal),
      parsed.request.modelId,
      distinctId,
    ),
  );
}
