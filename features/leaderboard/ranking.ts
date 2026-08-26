/**
 * The order of the board. Pure, and the only place that decides it.
 *
 * **Rank is win rate, and nothing else pretends to be a score.** There is no
 * Elo, no confidence adjustment, no invented points — the brief is explicit that
 * a record is "won 4 of 5" and never a made-up number, and a ranking formula
 * would be exactly that number wearing a different hat.
 *
 * **A model with one vote can therefore sit at the top, and that is allowed
 * here for a reason.** The obvious guard is a minimum number of judged turns,
 * with everyone below it in an unranked group. It is more honest in the abstract
 * and useless in fact at the vote counts this app has: every model lands in the
 * bottom group and the ranked table reads as empty. What makes pure rate safe is
 * something feature 4 already built — `WinRate` never prints a percentage
 * without the count beside it, so a model on top with one vote says "won 1 of 1"
 * in the same breath. The design refuses to let a thin record look thick, which
 * is the actual problem the threshold was there to solve.
 *
 * Ties go to the model that has been judged more often, which is the one thing
 * that can be said between two identical rates without inventing anything. After
 * that, the slug, so the order is stable rather than whatever the database
 * happened to return.
 */

import { winRate } from "@/features/design/format";

import type { LeaderboardRow, ModelTally } from "./types";

/**
 * A model nobody has judged has no rate at all — `winRate` returns `null` rather
 * than zero, because zero would claim it lost. Those sort to the bottom as a
 * block, ordered by how much they have actually answered, which is the only
 * evidence they carry.
 */
const compare = (a: ModelTally, b: ModelTally): number => {
  const rateA = winRate(a.won, a.judged);
  const rateB = winRate(b.won, b.judged);

  if (rateA === null && rateB === null) {
    if (a.answered !== b.answered) return b.answered - a.answered;
    return a.modelId.localeCompare(b.modelId);
  }
  if (rateA === null) return 1;
  if (rateB === null) return -1;

  if (rateA !== rateB) return rateB - rateA;
  if (a.judged !== b.judged) return b.judged - a.judged;
  return a.modelId.localeCompare(b.modelId);
};

/**
 * Tallies to rows: ranked, named, and placed.
 *
 * The copy is not incidental — `sort` mutates, and the input is a `readonly`
 * array for the same reason everything else here is.
 */
export const rankModels = (
  tallies: readonly ModelTally[],
  nameOf: (modelId: string) => string,
): readonly LeaderboardRow[] =>
  [...tallies].sort(compare).map((tally, index) => ({
    ...tally,
    modelName: nameOf(tally.modelId),
    place: index + 1,
  }));

/**
 * Whether anything on this board has been voted on at all.
 *
 * Distinct from "is the board empty": a board full of models that have answered
 * plenty and been judged never is a real state, and it needs its own sentence,
 * because otherwise every rate is an em dash with nothing explaining why.
 */
export const anyJudged = (rows: readonly LeaderboardRow[]): boolean =>
  rows.some((row) => row.judged > 0);
