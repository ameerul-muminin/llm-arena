"use server";

import { auth } from "@clerk/nextjs/server";
import { request as arcjetRequest } from "@arcjet/next";

import { failure } from "@/features/model-call/failures";
import type { ModelCallFailure } from "@/features/model-call/types";
import { describeDecisionForLog, toProtectionOutcome } from "@/features/model-call/protection";
import { findResponseId } from "@/features/thread/queries";
import { appendTurn, castVote, createThread } from "@/features/thread/writes";
import { ajStartTurn } from "@/lib/arcjet";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * The two writes a person makes: submitting a prompt, and picking a winner.
 *
 * Both are actions rather than routes because neither streams — they are a
 * single decision each, and the streaming half of this feature is already its
 * own endpoint for a reason no mutation shares.
 *
 * **Nothing here returns an exception to the browser.** Every outcome is a
 * value carrying a plain sentence, the same shape `refusals.ts` and
 * `failures.ts` already use, so a caller has to handle a refusal to typecheck
 * and a person never sees a stack trace.
 */

const MAX_PROMPT_LENGTH = 8000;

export type StartTurnResult =
  | {
      readonly ok: true;
      readonly threadId: string;
      readonly turnId: string;
      readonly ordinal: number;
    }
  | { readonly ok: false; readonly message: string };

const refused = (message: string): StartTurnResult => ({ ok: false, message });

const asRefusal = (called: ModelCallFailure): StartTurnResult => refused(called.message);

/**
 * Create the thread and its first turn, or append a turn to one that exists.
 *
 * The write happens before a single model is called, which is what stops three
 * parallel requests racing to create the turn they all need. The line-up is
 * stored with the thread on creation and never taken from the caller again:
 * after the first prompt it is fixed, and the model-call route re-checks every
 * request against it.
 */
export async function startTurn(input: {
  readonly threadId: string | null;
  readonly prompt: string;
  readonly modelIds: readonly string[];
}): Promise<StartTurnResult> {
  const prompt = input.prompt.trim();

  if (prompt === "") return refused("Write a prompt first.");
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return refused("That prompt is too long to send.");
  }
  if (input.threadId === null && input.modelIds.length === 0) {
    return refused("Pick at least one model to ask.");
  }

  const { userId } = await auth();
  if (userId === null) return refused(failure("sign-in-required").message);

  // Screened once, here, rather than once per model call. Three calls carrying
  // one prompt meant paying three times to ask the same question three times
  // and risking three different answers to it.
  const decision = await ajStartTurn.protect(await arcjetRequest(), {
    detectPromptInjectionMessage: prompt,
  });

  const outcome = toProtectionOutcome(decision);

  if (!outcome.allowed) {
    console.warn(`[arcjet] denied ${describeDecisionForLog(decision)}`);
    getPostHogClient()?.capture({
      distinctId: userId,
      event: "prompt_denied",
      properties: {
        failure_kind: outcome.failure.kind,
        arcjet_reason: decision.reason.type,
      },
    });
    await getPostHogClient()?.flush();
    return asRefusal(outcome.failure);
  }

  const threadId = input.threadId;

  const started: StartTurnResult =
    threadId === null
      ? await createThread({ ownerId: userId, prompt, modelIds: input.modelIds }).then(
          (created) => ({
            ok: true,
            threadId: created.threadId,
            turnId: created.turnId,
            ordinal: 0,
          }),
        )
      : await appendTurn({ threadId, ownerId: userId, prompt }).then((result): StartTurnResult =>
          result.ok
            ? { ok: true, threadId, turnId: result.value.turnId, ordinal: result.value.ordinal }
            : refused(result.message),
        );

  if (!started.ok) return started;

  getPostHogClient()?.capture({
    distinctId: userId,
    event: "prompt_sent",
    properties: {
      thread_id: started.threadId,
      turn_id: started.turnId,
      ordinal: started.ordinal,
      model_count: input.modelIds.length,
      new_thread: input.threadId === null,
    },
  });
  await getPostHogClient()?.flush();

  return started;
}

export type PickWinnerResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Pick the winning answer for one turn.
 *
 * Named by turn and model, never by response id, because the browser is never
 * told one — see `findResponseId`. Everything that can refuse this is already
 * written down in `refusals.ts`, including the rule the schema cannot express:
 * fewer than two answers means there was nothing to compare.
 */
export async function pickWinner(input: {
  readonly turnId: string;
  readonly modelId: string;
}): Promise<PickWinnerResult> {
  const { userId } = await auth();
  if (userId === null) return { ok: false, message: failure("sign-in-required").message };

  const responseId = await findResponseId(input.turnId, input.modelId);

  if (responseId === null) {
    return { ok: false, message: "That answer isn't one of the answers to this prompt." };
  }

  const result = await castVote({
    turnId: input.turnId,
    voterId: userId,
    winningResponseId: responseId,
  });

  if (!result.ok) return { ok: false, message: result.message };

  getPostHogClient()?.capture({
    distinctId: userId,
    event: "vote_cast",
    properties: { turn_id: input.turnId, model_id: input.modelId },
  });
  await getPostHogClient()?.flush();

  return { ok: true };
}
