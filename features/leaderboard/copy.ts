/**
 * Every sentence this screen can say, in one place.
 *
 * Written from the reader's side, per feature 4: what they are looking at and
 * what would make it fill up, never which feature owns it or which table is
 * empty. The three absences below are genuinely three different facts and get
 * three different sentences rather than one shrug covering all of them.
 */

import type { BoardScope } from "./scope";

export const BOARD_BLURB =
  "Every model's real record, from actual head-to-head votes. No cost column — every model here is free tier, so it would never mean anything.";

/** The heading and one line under it, for whichever board is open. */
export const BOARD_HEADING: Record<BoardScope, { readonly title: string; readonly note: string }> =
  {
    global: {
      title: "Global ranking",
      note: "Every vote from everyone, ranked by real wins.",
    },
    personal: {
      title: "Your ranking",
      note: "Only the threads you started, and only the turns you judged.",
    },
  };

/**
 * Nothing has answered yet. The global version points at the arena; the personal
 * one points at this person's own empty history, because "no model has answered
 * a prompt" would be false on a busy app and is not what they are looking at.
 */
export const NOTHING_ANSWERED: Record<BoardScope, string> = {
  global: "No model has answered a prompt yet. Send one in the arena and this fills up.",
  personal:
    "None of your threads has an answer in it yet. Send a prompt in the arena and your own record starts here.",
};

/**
 * Answers exist, votes do not. Without this the table is a wall of em dashes
 * with nothing saying why, which reads as broken rather than as early.
 */
export const NOTHING_JUDGED: Record<BoardScope, string> = {
  global:
    "No turn has been voted on yet, so there is no win rate to show. The speeds below are real.",
  personal:
    "You have not picked a winner in any of your threads yet, so there is no win rate to show. The speeds below are real.",
};
