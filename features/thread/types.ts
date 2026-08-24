/**
 * The stored shape of a conversation, as the rest of the app sees it.
 *
 * Database rows never leave this feature. Everything here is the domain shape:
 * a response is either answered or failed, and the difference is a discriminated
 * union rather than a pile of nullable columns the caller has to interpret. That
 * interpretation happens once, in `mappers.ts`.
 *
 * `ModelMetrics` and `ModelCallFailure` are imported from `features/model-call`
 * on purpose. That module's own doc comment calls itself "the contract between a
 * model call and everything downstream of it", and this is downstream. Copying
 * the metrics type here would create a second place for it to drift, which is
 * exactly what the one-place-for-derived-numbers rule exists to prevent. The
 * dependency runs one way only: model-call never imports from here.
 */

import type { ModelCallFailure, ModelMetrics } from "@/features/model-call/types";

export type ThreadSummary = {
  readonly id: string;
  readonly ownerId: string;
  /** Null until someone names it. The UI falls back to the first prompt. */
  readonly title: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type AnsweredResponse = {
  readonly kind: "answered";
  readonly id: string;
  readonly modelId: string;
  readonly text: string;
  readonly metrics: ModelMetrics;
};

export type FailedResponse = {
  readonly kind: "failed";
  readonly id: string;
  readonly modelId: string;
  /**
   * Whatever had already arrived before it broke. Real for an aborted answer,
   * null for one that never started. Never an empty string standing in for
   * "nothing", because those are different facts.
   */
  readonly partialText: string | null;
  readonly failure: ModelCallFailure;
};

export type StoredResponse = AnsweredResponse | FailedResponse;

export type StoredTurn = {
  readonly id: string;
  readonly ordinal: number;
  readonly prompt: string;
  readonly responses: readonly StoredResponse[];
  /** Null when this turn has not been judged. */
  readonly winningResponseId: string | null;
};

export type StoredThread = ThreadSummary & {
  readonly turns: readonly StoredTurn[];
};
