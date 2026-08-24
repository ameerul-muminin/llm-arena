/**
 * Row → domain, and the metrics half of domain → row. Pure, no client, no
 * awaits: the only file that knows a `ModelResponse` row is a flat bag of
 * nullable columns rather than the discriminated union everything else works
 * with.
 *
 * The asymmetry between the two directions is deliberate. Writing a metrics
 * object out is a straight field-for-field copy, because `ModelMetrics` is
 * already the honest shape — a `null` column means the provider did not report
 * it, and it stays null rather than becoming a zero. Reading one back has to
 * decide whether the row is an answer at all, which is what `status` is for.
 */

import { failure } from "@/features/model-call/failures";
import type { ModelMetrics } from "@/features/model-call/types";
// Prisma 7's client generator suffixes the plain row types with `Model`; the
// unsuffixed names belong to the query-argument types.
import type { ModelResponseModel, ThreadModel, TurnModel } from "@/lib/generated/prisma/models";

import { fromStoredFailureKind } from "./failure-kind";
import type { StoredResponse, StoredThread, StoredTurn, ThreadSummary } from "./types";

/**
 * The metrics columns, as they are written. Every field of `ModelMetrics`
 * appears here, so widening that type without widening the table is a
 * typecheck error at the call site rather than a column that silently stops
 * being recorded.
 */
export type MetricsColumns = {
  readonly [K in keyof ModelMetrics]: ModelMetrics[K] | null;
};

export const toMetricsColumns = (metrics: ModelMetrics): MetricsColumns => ({
  timeToFirstTokenMs: metrics.timeToFirstTokenMs,
  generationMs: metrics.generationMs,
  totalMs: metrics.totalMs,
  deltaCount: metrics.deltaCount,
  streamed: metrics.streamed,
  tokensPerSecond: metrics.tokensPerSecond,
  endToEndTokensPerSecond: metrics.endToEndTokensPerSecond,
  inputTokens: metrics.inputTokens,
  outputTokens: metrics.outputTokens,
  reasoningTokens: metrics.reasoningTokens,
  textTokens: metrics.textTokens,
  totalTokens: metrics.totalTokens,
});

/**
 * `totalMs`, `deltaCount`, and `streamed` are nullable in the table because a
 * failed row has none of them, but an answered row always does — they are
 * measured by us, not reported by the provider. A row claiming ANSWERED without
 * them is corrupt rather than merely incomplete, so the defaults below exist to
 * satisfy the type and should never actually be reached.
 */
const toMetrics = (row: ModelResponseModel): ModelMetrics => ({
  timeToFirstTokenMs: row.timeToFirstTokenMs,
  generationMs: row.generationMs,
  totalMs: row.totalMs ?? 0,
  deltaCount: row.deltaCount ?? 0,
  streamed: row.streamed ?? false,
  tokensPerSecond: row.tokensPerSecond,
  endToEndTokensPerSecond: row.endToEndTokensPerSecond,
  inputTokens: row.inputTokens,
  outputTokens: row.outputTokens,
  reasoningTokens: row.reasoningTokens,
  textTokens: row.textTokens,
  totalTokens: row.totalTokens,
});

export const toStoredResponse = (row: ModelResponseModel): StoredResponse =>
  row.status === "ANSWERED"
    ? {
        kind: "answered",
        id: row.id,
        modelId: row.modelId,
        text: row.text ?? "",
        metrics: toMetrics(row),
      }
    : {
        kind: "failed",
        id: row.id,
        modelId: row.modelId,
        partialText: row.text,
        // The sentence is derived now, never read from the row, so improving
        // the wording improves every thread already stored.
        failure: failure(
          row.failureKind === null ? "unknown" : fromStoredFailureKind(row.failureKind),
        ),
      };

export const toThreadSummary = (row: ThreadModel): ThreadSummary => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  modelIds: row.modelIds,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

type TurnRow = TurnModel & {
  readonly responses: readonly ModelResponseModel[];
  readonly vote: { readonly winningResponseId: string } | null;
};

export const toStoredTurn = (row: TurnRow): StoredTurn => ({
  id: row.id,
  ordinal: row.ordinal,
  prompt: row.prompt,
  responses: row.responses.map(toStoredResponse),
  winningResponseId: row.vote?.winningResponseId ?? null,
});

export const toStoredThread = (
  row: ThreadModel & { readonly turns: readonly TurnRow[] },
): StoredThread => ({
  ...toThreadSummary(row),
  turns: row.turns.map(toStoredTurn),
});
