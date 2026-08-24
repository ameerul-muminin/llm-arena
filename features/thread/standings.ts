import type { Standing, StoredThread, StoredTurn } from "./types";

/**
 * This thread's record so far, derived from the turns rather than counted into
 * a column.
 *
 * A denormalised tally would be a second copy of something the votes already
 * say, and it would have to be kept right on every retry and every re-vote. At
 * one thread's worth of turns this is a fold over data the page has already
 * read.
 *
 * The denominator is the honest one feature 9 insists on: a turn counts for a
 * model only if that model answered it *and* the turn was judged. A model that
 * failed on a judged turn was never in that comparison, and counting it as a
 * loss would blame it for a race it did not run.
 *
 * Order follows the thread's line-up, not the score. These sit in the top bar
 * across a whole thread, and a readout that reorders itself as votes land is
 * one nobody can read at a glance.
 */

type Tally = { readonly won: number; readonly judged: number };

const EMPTY: Tally = { won: 0, judged: 0 };

const tallyTurn = (turn: StoredTurn, modelId: string, running: Tally): Tally => {
  if (turn.winningResponseId === null) return running;

  const answer = turn.responses.find(
    (response) => response.modelId === modelId && response.kind === "answered",
  );
  if (answer === undefined) return running;

  return {
    won: running.won + (answer.id === turn.winningResponseId ? 1 : 0),
    judged: running.judged + 1,
  };
};

export const standingsFor = (
  thread: StoredThread,
  nameOf: (modelId: string) => string,
): readonly Standing[] =>
  thread.modelIds.map((modelId) => {
    const tally = thread.turns.reduce((running, turn) => tallyTurn(turn, modelId, running), EMPTY);
    return { modelId, modelName: nameOf(modelId), won: tally.won, judged: tally.judged };
  });
