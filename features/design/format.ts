/**
 * How a measured number becomes text on a screen. Pure, and the only place that
 * decides it.
 *
 * The honesty rules from `CLAUDE.md` and feature 1 are mechanical here rather
 * than remembered: anything the provider did not report is `null` and comes out
 * as an em dash, never as a zero and never as a blank that looks like a bug. A
 * model that flushed its whole answer at once has no observable generation
 * speed, so that reads as a sentence explaining itself rather than as a gap.
 *
 * Cost is a constant, not a measurement. Every model in this app is free tier,
 * so it is stated once here and shown as the real number it is.
 */

/** What a number we do not have looks like. */
export const EM_DASH = "—";

/**
 * Elapsed time, at the precision a person can actually act on. Sub-second
 * answers are the interesting ones, so they keep their milliseconds; past that,
 * a tenth of a second is as much resolution as the reader needs.
 */
export const formatMs = (ms: number | null): string => {
  if (ms === null) return EM_DASH;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
};

export const formatTokensPerSecond = (value: number | null): string =>
  value === null ? EM_DASH : `${Math.round(value)} tok/s`;

export const formatTokens = (value: number | null): string =>
  value === null ? EM_DASH : new Intl.NumberFormat("en-US").format(value);

/**
 * Not a placeholder. Every model here is free tier, so this is a real, honestly
 * measured number that happens to be the same every time, and the rules say to
 * show it rather than hide it.
 */
export const FREE_TIER_COST = "$0.0000";

/**
 * The one sentence a card can print instead of a speed, when there genuinely
 * was no window to measure a speed over.
 */
export const ARRIVED_IN_ONE_CHUNK = "arrived in one chunk";

/**
 * Always "won 4 of 5", never a bare percentage and never an invented score. The
 * denominator is turns that were actually judged, which is what makes the
 * phrasing true.
 */
export const formatWinRecord = (won: number, judged: number): string => `won ${won} of ${judged}`;

/**
 * `null` rather than zero when nothing has been judged yet. A model with no
 * votes has no win rate; printing 0% would claim it lost.
 */
export const winRate = (won: number, judged: number): number | null =>
  judged === 0 ? null : won / judged;

export const formatWinRate = (rate: number | null): string =>
  rate === null ? EM_DASH : `${Math.round(rate * 100)}%`;

/**
 * The short name in a win chip: the model's own initial, taken from the part of
 * the slug after the vendor. `google/gemma-4-31b-it:free` is a Gemma, not a G
 * for Google, because two Google models in one thread would both read G.
 */
export const modelInitial = (modelId: string): string => {
  const afterVendor = modelId.split("/").at(-1) ?? modelId;
  return (afterVendor.at(0) ?? "?").toUpperCase();
};
