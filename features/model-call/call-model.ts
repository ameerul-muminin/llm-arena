import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type LanguageModel, type ModelMessage } from "ai";

import { getEnv } from "@/env";

import { describeForLog, failure, toFailure } from "./failures";
import { computeMetrics, type TokenCounts } from "./metrics";
import type { ModelCallEvent, ModelInvocation } from "./types";

/**
 * One model, one call, one stream of typed events.
 *
 * Deliberately knows nothing about HTTP, React, or the other two models running
 * beside it. Whatever goes wrong in here becomes an `error` event and the
 * generator ends; it never throws at the caller and never takes anything else
 * down with it.
 */

export type ModelCallDeps = {
  readonly now: () => number;
  readonly createModel: (modelId: string) => LanguageModel;
  readonly logError: (message: string) => void;
};

const toModelMessages = (messages: ModelInvocation["messages"]): readonly ModelMessage[] =>
  messages.map((message) => ({ role: message.role, content: message.content }));

export const defaultDeps: ModelCallDeps = {
  now: () => Date.now(),
  createModel: (modelId) => createOpenRouter({ apiKey: getEnv().OPENROUTER_API_KEY })(modelId),
  logError: (message) => console.error(`[model-call] ${message}`),
};

export async function* callModel(
  invocation: ModelInvocation,
  signal?: AbortSignal,
  deps: ModelCallDeps = defaultDeps,
): AsyncGenerator<ModelCallEvent, void> {
  const startedAt = deps.now();
  let firstDeltaAt: number | null = null;
  let lastDeltaAt: number | null = null;
  let deltaCount = 0;
  let tokens: TokenCounts = {
    inputTokens: undefined,
    outputTokens: undefined,
    reasoningTokens: undefined,
    textTokens: undefined,
    totalTokens: undefined,
  };

  yield { type: "start", modelId: invocation.modelId };

  try {
    const result = streamText({
      model: deps.createModel(invocation.modelId),
      messages: [...toModelMessages(invocation.messages)],
      abortSignal: signal,
      // Without this the SDK logs the raw error itself; we want it logged our way.
      onError: ({ error }) => deps.logError(describeForLog(error)),
    });

    for await (const part of result.stream) {
      switch (part.type) {
        case "text-delta": {
          if (part.text === "") break;
          const at = deps.now();
          firstDeltaAt = firstDeltaAt ?? at;
          lastDeltaAt = at;
          // Counted so the metrics can tell a real stream apart from a single
          // buffered flush, rather than reporting a speed for both.
          deltaCount += 1;
          yield { type: "delta", text: part.text };
          break;
        }
        case "finish": {
          tokens = {
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
            // A reasoning model can burn hundreds of tokens on a one-line
            // answer. Kept separate so the total does not read as verbosity.
            reasoningTokens: part.totalUsage.outputTokenDetails.reasoningTokens,
            textTokens: part.totalUsage.outputTokenDetails.textTokens,
            totalTokens: part.totalUsage.totalTokens,
          };
          break;
        }
        case "abort": {
          yield { type: "error", failure: failure("aborted") };
          return;
        }
        case "error": {
          yield { type: "error", failure: toFailure(part.error) };
          return;
        }
        default:
          break;
      }
    }

    yield {
      type: "done",
      metrics: computeMetrics(
        { startedAt, firstDeltaAt, lastDeltaAt, finishedAt: deps.now(), deltaCount },
        tokens,
      ),
    };
  } catch (error) {
    deps.logError(`${invocation.modelId} ${describeForLog(error)}`);
    yield { type: "error", failure: toFailure(error) };
  }
}
