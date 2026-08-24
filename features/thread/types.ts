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
  /** The line-up, fixed when the thread was created. See the schema. */
  readonly modelIds: readonly string[];
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

/**
 * A row in the sidebar's thread list.
 *
 * Not a `ThreadSummary`: the sidebar shows a title that is always a string, the
 * marks of the models that were in the thread, and how many turns it ran, which
 * is what actually makes a thread findable again. Resolving the title fallback
 * once, where the query already holds the first turn, keeps every caller from
 * repeating it.
 */
export type ThreadListRow = {
  readonly id: string;
  readonly title: string;
  readonly modelIds: readonly string[];
  readonly turnCount: number;
};

/**
 * One model's record within a single thread.
 *
 * `judged` counts the turns this model answered *and* that were then voted on,
 * never the turns it merely took part in. Counting unjudged turns would drag
 * every record toward zero and make "won 1 of 3" a lie about what was compared.
 */
export type Standing = {
  readonly modelId: string;
  readonly modelName: string;
  readonly won: number;
  readonly judged: number;
};
