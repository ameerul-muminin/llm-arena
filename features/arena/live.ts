import type { AnswerState } from "@/features/design/answer-card";
import type { AxisSpan } from "@/features/design/time-axis";
import type { ModelCallFailure, ModelMetrics } from "@/features/model-call/types";

import type { ResponseView, TurnView } from "./view";

/**
 * A turn happening right now, as a value.
 *
 * Every update is a pure function of the previous state and one event off the
 * wire, so the part of this feature that is easiest to get wrong — three
 * streams interleaving into one screen — is also the part with no effects in
 * it. The hook that owns the fetches does nothing but feed events in here.
 *
 * **Two clocks, and the honest one wins.** While a call is in flight the only
 * clock available is this browser's, so elapsed time on the axis is measured
 * from dispatch in the tab and includes the network. The moment the call
 * finishes, the server's `ModelMetrics` replaces all of it — those are measured
 * around the provider call itself, they are what gets stored, and they are what
 * the leaderboard will read. The live numbers exist to make the axis move; they
 * are never reported as the measurement.
 */

export type LiveResponse = {
  readonly modelId: string;
  readonly text: string;
  readonly startedAt: number;
  readonly firstDeltaAt: number | null;
  readonly lastDeltaAt: number | null;
  readonly finishedAt: number | null;
  readonly deltaCount: number;
  readonly metrics: ModelMetrics | null;
  readonly failure: ModelCallFailure | null;
};

export type LiveTurn = {
  readonly id: string;
  readonly ordinal: number;
  readonly prompt: string;
  readonly modelIds: readonly string[];
  /**
   * A `Map` rather than a record, because a lookup that can miss should say so
   * in its type. Indexing an object gives back the value type whatever the key,
   * which turns a real guard into what the linter reads as dead code — the same
   * trap feature 3 hit with `turns[0]`.
   */
  readonly responses: ReadonlyMap<string, LiveResponse>;
};

/**
 * Voting is deliberately not in here. A vote can be cast on a turn from a
 * previous visit, which this state has never seen — it only knows turns this
 * browser streamed — so keeping the winner in a small overlay beside it means
 * one path marks a winner instantly whether the turn is live or stored.
 */

export type LiveAction =
  | {
      readonly type: "turn-started";
      readonly id: string;
      readonly ordinal: number;
      readonly prompt: string;
      readonly modelIds: readonly string[];
      readonly at: number;
    }
  | {
      readonly type: "dispatched";
      readonly turnId: string;
      readonly modelId: string;
      readonly at: number;
    }
  | {
      readonly type: "delta";
      readonly turnId: string;
      readonly modelId: string;
      readonly text: string;
      readonly at: number;
    }
  | {
      readonly type: "done";
      readonly turnId: string;
      readonly modelId: string;
      readonly metrics: ModelMetrics;
      readonly at: number;
    }
  | {
      readonly type: "failed";
      readonly turnId: string;
      readonly modelId: string;
      readonly failure: ModelCallFailure;
      readonly at: number;
    };

const fresh = (modelId: string, at: number): LiveResponse => ({
  modelId,
  text: "",
  startedAt: at,
  firstDeltaAt: null,
  lastDeltaAt: null,
  finishedAt: null,
  deltaCount: 0,
  metrics: null,
  failure: null,
});

const updateResponse = (
  turn: LiveTurn,
  modelId: string,
  change: (response: LiveResponse) => LiveResponse,
): LiveTurn => {
  const existing = turn.responses.get(modelId);
  if (existing === undefined) return turn;
  return { ...turn, responses: new Map(turn.responses).set(modelId, change(existing)) };
};

const updateTurn = (
  turns: readonly LiveTurn[],
  turnId: string,
  change: (turn: LiveTurn) => LiveTurn,
): readonly LiveTurn[] => turns.map((turn) => (turn.id === turnId ? change(turn) : turn));

export const liveReducer = (
  turns: readonly LiveTurn[],
  action: LiveAction,
): readonly LiveTurn[] => {
  switch (action.type) {
    case "turn-started":
      return [
        ...turns,
        {
          id: action.id,
          ordinal: action.ordinal,
          prompt: action.prompt,
          modelIds: action.modelIds,
          responses: new Map(
            action.modelIds.map((modelId) => [modelId, fresh(modelId, action.at)]),
          ),
        },
      ];

    // A retry starts the same model over on the same turn, so its previous
    // attempt is cleared rather than merged with — the row is upserted server
    // side for the same reason.
    case "dispatched":
      return updateTurn(turns, action.turnId, (turn) => ({
        ...turn,
        responses: new Map(turn.responses).set(action.modelId, fresh(action.modelId, action.at)),
      }));

    case "delta":
      return updateTurn(turns, action.turnId, (turn) =>
        updateResponse(turn, action.modelId, (response) => ({
          ...response,
          text: response.text + action.text,
          firstDeltaAt: response.firstDeltaAt ?? action.at,
          lastDeltaAt: action.at,
          deltaCount: response.deltaCount + 1,
        })),
      );

    case "done":
      return updateTurn(turns, action.turnId, (turn) =>
        updateResponse(turn, action.modelId, (response) => ({
          ...response,
          finishedAt: action.at,
          metrics: action.metrics,
        })),
      );

    case "failed":
      return updateTurn(turns, action.turnId, (turn) =>
        updateResponse(turn, action.modelId, (response) => ({
          ...response,
          finishedAt: action.at,
          failure: action.failure,
        })),
      );
  }
};

const isRunning = (response: LiveResponse): boolean =>
  response.metrics === null && response.failure === null;

export const anyRunning = (turns: readonly LiveTurn[]): boolean =>
  turns.some((turn) => [...turn.responses.values()].some(isRunning));

const stateOf = (response: LiveResponse): AnswerState => {
  if (response.failure !== null) return { status: "failed", failure: response.failure };
  if (response.metrics !== null) {
    return { status: "done", text: response.text, metrics: response.metrics };
  }
  if (response.firstDeltaAt === null) return { status: "waiting" };
  return { status: "streaming", text: response.text };
};

const spanOf = (response: LiveResponse, nowMs: number): AxisSpan => {
  // Finished: the server's own measurement, which is the one that gets stored.
  if (response.metrics !== null) {
    return {
      timeToFirstTokenMs: response.metrics.timeToFirstTokenMs,
      generationMs: response.metrics.generationMs,
      elapsedMs: response.metrics.totalMs,
      streamed: response.metrics.streamed,
      outcome: "finished",
    };
  }

  const startedTo = (at: number | null): number | null =>
    at === null ? null : at - response.startedAt;
  const elapsedMs = (response.finishedAt ?? nowMs) - response.startedAt;

  if (response.failure !== null) {
    return {
      timeToFirstTokenMs: startedTo(response.firstDeltaAt),
      generationMs: null,
      elapsedMs,
      streamed: false,
      outcome: "failed",
    };
  }

  // Still going. More than one chunk is the only evidence available mid-flight
  // that this model is genuinely streaming rather than about to flush in one
  // go, which is the same structural test `metrics.ts` applies at the end.
  const streaming = response.deltaCount > 1;

  return {
    timeToFirstTokenMs: startedTo(response.firstDeltaAt),
    generationMs:
      streaming && response.firstDeltaAt !== null && response.lastDeltaAt !== null
        ? response.lastDeltaAt - response.firstDeltaAt
        : null,
    elapsedMs,
    streamed: streaming,
    outcome: "running",
  };
};

export const liveTurnView = (
  turn: LiveTurn,
  nameOf: (modelId: string) => string,
  nowMs: number,
): TurnView => ({
  id: turn.id,
  ordinal: turn.ordinal,
  prompt: turn.prompt,
  winnerModelId: null,
  responses: turn.modelIds.flatMap((modelId): readonly ResponseView[] => {
    const response = turn.responses.get(modelId);
    if (response === undefined) return [];
    return [
      {
        modelId,
        modelName: nameOf(modelId),
        state: stateOf(response),
        span: spanOf(response, nowMs),
      },
    ];
  }),
});

/** How many models have genuinely answered, which is what makes a vote possible. */
export const answeredCount = (view: TurnView): number =>
  view.responses.filter((response) => response.state.status === "done").length;

/**
 * The most recent moment anything actually happened.
 *
 * Under reduced motion the axis is not animated, so this stands in for the
 * animation clock: elapsed time advances when a token lands rather than sixty
 * times a second. Feature 4 asked for the axis to read its final state rather
 * than animate into it, and a track that creeps forward continuously is exactly
 * the motion that asks to be turned off.
 */
export const lastEventAt = (turns: readonly LiveTurn[]): number =>
  turns.reduce(
    (latest, turn) =>
      [...turn.responses.values()].reduce(
        (inner, response) =>
          Math.max(inner, response.finishedAt ?? response.lastDeltaAt ?? response.startedAt),
        latest,
      ),
    0,
  );
