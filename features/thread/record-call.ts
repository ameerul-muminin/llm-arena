import "server-only";

import type { ModelCallEvent } from "@/features/model-call/types";
import { captureGeneration, getPostHogClient } from "@/lib/posthog-server";

import { recordAnswer, recordFailure } from "./writes";

/**
 * Records what happened, then passes the event on.
 *
 * The write lands *before* the terminal event reaches the browser, which is
 * what makes the vote possible: the moment a card says "done", the row it will
 * be voted for exists. Everything else in here is deliberately fire-and-forget
 * ordering — a delta is never delayed by a database call.
 *
 * A disconnected browser cancels this generator, so a row may never be written
 * for a stream nobody was left to read. That gap is feature 3's, stated there,
 * and it is still preferred over writing a fabricated "incomplete" row.
 */
export async function* recordAndTrack(
  events: AsyncGenerator<ModelCallEvent, void>,
  context: { readonly turnId: string; readonly modelId: string; readonly distinctId: string },
): AsyncGenerator<ModelCallEvent, void> {
  const posthog = getPostHogClient();
  let text = "";

  for await (const event of events) {
    if (event.type === "delta") text += event.text;

    if (event.type === "done") {
      await recordAnswer({
        turnId: context.turnId,
        modelId: context.modelId,
        text,
        metrics: event.metrics,
      });

      posthog?.capture({
        distinctId: context.distinctId,
        event: "model_answered",
        properties: {
          model_id: context.modelId,
          turn_id: context.turnId,
          total_ms: event.metrics.totalMs,
          time_to_first_token_ms: event.metrics.timeToFirstTokenMs,
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
      captureGeneration({
        distinctId: context.distinctId,
        traceId: context.turnId,
        modelId: context.modelId,
        metrics: event.metrics,
        failed: false,
      });
      await posthog?.flush();
    }

    if (event.type === "error") {
      await recordFailure({
        turnId: context.turnId,
        modelId: context.modelId,
        kind: event.failure.kind,
        // An empty string and "nothing arrived" are different facts, and the
        // column is nullable so it can say which one this was.
        partialText: text === "" ? null : text,
      });

      posthog?.capture({
        distinctId: context.distinctId,
        event: "model_failed",
        properties: {
          model_id: context.modelId,
          turn_id: context.turnId,
          failure_kind: event.failure.kind,
          retryable: event.failure.retryable,
        },
      });
      captureGeneration({
        distinctId: context.distinctId,
        traceId: context.turnId,
        modelId: context.modelId,
        metrics: null,
        failed: true,
      });
      await posthog?.flush();
    }

    yield event;
  }
}
