import type { ModelMetrics } from "./types";

/**
 * Pure timing maths. The only thing the caller does is stamp clock readings and
 * hand over whatever token counts the provider reported; every derived number
 * is computed here, in one place, so the card, the leaderboard, and any
 * analytics all agree by construction.
 */

export type TokenCounts = {
  readonly inputTokens: number | undefined;
  readonly outputTokens: number | undefined;
  readonly reasoningTokens: number | undefined;
  readonly textTokens: number | undefined;
  readonly totalTokens: number | undefined;
};

export type Timings = {
  readonly startedAt: number;
  /** Null when the model never produced a single token. */
  readonly firstDeltaAt: number | null;
  readonly lastDeltaAt: number | null;
  readonly finishedAt: number;
  /** How many separate text chunks arrived. */
  readonly deltaCount: number;
};

/**
 * The number of chunks is the honest structural evidence that an answer arrived
 * over time rather than in one flush. A handful of separate arrivals is real
 * streaming; one or two is a delivery, however long it took.
 */
const MIN_DELTAS_TO_MEASURE_RATE = 4;

/**
 * A floor purely to stop the division exploding. Elapsed time alone is a poor
 * test — a model that sends forty chunks inside two hundred milliseconds really
 * did stream, it was simply fast, and throwing that measurement away would be
 * its own kind of dishonesty.
 */
const MIN_GENERATION_MS_TO_MEASURE_RATE = 50;

const finite = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const perSecond = (tokens: number | null, elapsedMs: number | null): number | null => {
  if (tokens === null || elapsedMs === null) return null;
  if (tokens <= 0 || elapsedMs <= 0) return null;
  return (tokens / elapsedMs) * 1000;
};

/**
 * Did the answer genuinely arrive over time, or was it thought about and then
 * delivered in one go? Only the first case has a generation speed worth stating.
 */
const didStream = (deltaCount: number, generationMs: number | null): boolean =>
  deltaCount >= MIN_DELTAS_TO_MEASURE_RATE &&
  generationMs !== null &&
  generationMs >= MIN_GENERATION_MS_TO_MEASURE_RATE;

export const computeMetrics = (timings: Timings, tokens: TokenCounts): ModelMetrics => {
  const outputTokens = finite(tokens.outputTokens);
  const inputTokens = finite(tokens.inputTokens);
  const textTokens = finite(tokens.textTokens);
  const totalMs = timings.finishedAt - timings.startedAt;

  /**
   * Generation speed must divide by the tokens that actually arrived in that
   * window. A reasoning model does its thinking before it writes a word, so
   * those tokens exist nowhere in the streamed span — counting them against it
   * inflated one real measurement here roughly ninefold. Fall back to the total
   * only when the provider does not report the split.
   */
  const streamedTokens = textTokens ?? outputTokens;

  const generationMs =
    timings.firstDeltaAt !== null && timings.lastDeltaAt !== null
      ? timings.lastDeltaAt - timings.firstDeltaAt
      : null;

  const streamed = didStream(timings.deltaCount, generationMs);

  return {
    timeToFirstTokenMs:
      timings.firstDeltaAt !== null ? timings.firstDeltaAt - timings.startedAt : null,
    generationMs,
    totalMs,
    deltaCount: timings.deltaCount,
    streamed,
    // Stated only when it means something. See `didStream`.
    tokensPerSecond: streamed ? perSecond(streamedTokens, generationMs) : null,
    // Everything the model produced, thinking included, over the whole wait.
    // That is the number a person actually experiences.
    endToEndTokensPerSecond: perSecond(outputTokens, totalMs),
    inputTokens,
    outputTokens,
    reasoningTokens: finite(tokens.reasoningTokens),
    textTokens,
    totalTokens:
      finite(tokens.totalTokens) ??
      (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
  };
};
