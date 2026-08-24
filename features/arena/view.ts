import type { AnswerState } from "@/features/design/answer-card";
import type { AxisSpan } from "@/features/design/time-axis";
import type { StoredResponse, StoredThread, StoredTurn } from "@/features/thread/types";

/**
 * What the arena actually renders, and the one shape both halves produce.
 *
 * A turn on screen comes from one of two places: rows read out of the database,
 * or a call happening right now in this browser. They render identically, so
 * they are mapped to one type here — pure, so the mapping is readable in one
 * place rather than smeared across a component that is also managing streams.
 *
 * The card, the metrics row and the time axis are unchanged from feature 4.
 * They already take exactly `AnswerState` and `AxisSpan`, which is what makes
 * this file a mapping rather than a rewrite.
 */

export type ResponseView = {
  readonly modelId: string;
  readonly modelName: string;
  readonly state: AnswerState;
  readonly span: AxisSpan;
};

export type TurnView = {
  readonly id: string;
  readonly ordinal: number;
  readonly prompt: string;
  readonly responses: readonly ResponseView[];
  /** The model that won this turn, once it has been judged. */
  readonly winnerModelId: string | null;
};

/**
 * A stored answer's own timings, read back off the row.
 *
 * A stored failure has no timings at all — `recordFailure` writes every metric
 * column null, because a call that broke has none of them honestly. So its
 * track has nothing to draw and says so, rather than inventing a length for a
 * run nobody measured.
 */
const spanOf = (response: StoredResponse): AxisSpan =>
  response.kind === "answered"
    ? {
        timeToFirstTokenMs: response.metrics.timeToFirstTokenMs,
        generationMs: response.metrics.generationMs,
        elapsedMs: response.metrics.totalMs,
        streamed: response.metrics.streamed,
        outcome: "finished",
      }
    : {
        timeToFirstTokenMs: null,
        generationMs: null,
        elapsedMs: 0,
        streamed: false,
        outcome: "failed",
      };

const stateOf = (response: StoredResponse): AnswerState =>
  response.kind === "answered"
    ? { status: "done", text: response.text, metrics: response.metrics }
    : { status: "failed", failure: response.failure };

/**
 * The turn as stored, in line-up order rather than in whatever order the rows
 * came back. The columns must sit in the same order on every visit, or the
 * comparison the whole screen is for gets harder for no reason.
 *
 * A model in the line-up with no row at all is left out entirely: it was never
 * called — refused before it got that far, or the browser left mid-stream — and
 * an empty card claiming otherwise would be the fabricated row feature 3 turned
 * down.
 *
 * **The line-up decides the order, never what is shown.** Anything that
 * answered gets a card even if it is not in the line-up, because it genuinely
 * did answer and the page's job is to say what happened. Filtering by the
 * line-up alone was a real bug for a moment: threads created before that column
 * existed read back with an empty one, and every stored answer silently vanished
 * from the page while the thread still listed its prompts.
 */
export const storedTurnView = (
  thread: StoredThread,
  turn: StoredTurn,
  nameOf: (modelId: string) => string,
): TurnView => {
  const ordered = [
    ...thread.modelIds,
    ...turn.responses
      .map((response) => response.modelId)
      .filter((modelId) => !thread.modelIds.includes(modelId)),
  ];

  const responses = ordered.flatMap((modelId): readonly ResponseView[] => {
    const response = turn.responses.find((candidate) => candidate.modelId === modelId);
    if (response === undefined) return [];
    return [
      { modelId, modelName: nameOf(modelId), state: stateOf(response), span: spanOf(response) },
    ];
  });

  const winner = turn.responses.find((response) => response.id === turn.winningResponseId);

  return {
    id: turn.id,
    ordinal: turn.ordinal,
    prompt: turn.prompt,
    responses,
    winnerModelId: winner?.modelId ?? null,
  };
};

export const storedTurnViews = (
  thread: StoredThread,
  nameOf: (modelId: string) => string,
): readonly TurnView[] => thread.turns.map((turn) => storedTurnView(thread, turn, nameOf));

/**
 * Stored turns and live ones, as one list.
 *
 * A turn can legitimately be in both: the browser streamed it, and then a
 * refresh re-read the same turn from the database. The live one wins, because
 * it is the one holding text this browser has already painted, and swapping it
 * for an identical stored copy mid-turn would flicker for no gain.
 */
export const mergeTurns = (
  stored: readonly TurnView[],
  live: readonly TurnView[],
): readonly TurnView[] => {
  const liveById = new Map(live.map((turn) => [turn.id, turn]));
  const merged = [
    ...stored.map((turn) => liveById.get(turn.id) ?? turn),
    ...live.filter((turn) => !stored.some((candidate) => candidate.id === turn.id)),
  ];

  return [...merged].sort((a, b) => a.ordinal - b.ordinal);
};
