"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/features/design/reduced-motion";
import { streamModelCall } from "@/features/model-call/client";

import { pickWinner, startTurn } from "./actions";
import { anyRunning, lastEventAt, liveReducer, liveTurnView, type LiveTurn } from "./live";
import { mergeTurns, type TurnView } from "./view";

/**
 * The live half of the arena: three streams, one screen, nothing shared between
 * them but a clock.
 *
 * Every model gets its own request and its own `AbortController`, which is the
 * transport decision feature 1 made and the entire reason one model failing is
 * invisible to the other two. Nothing here is multiplexed and nothing waits on
 * anything else.
 *
 * State updates are all pure — the reducer in `live.ts` — so this file is only
 * the effectful edge: it starts fetches, feeds events in, and aborts what is
 * still running when the screen goes away.
 */

type Vote = { readonly winnerModelId?: string; readonly message?: string };

export type ArenaInput = {
  readonly threadId: string;
  /** The thread's fixed line-up. Every turn asks exactly these models. */
  readonly modelIds: readonly string[];
  readonly storedTurns: readonly TurnView[];
  readonly nameOf: (modelId: string) => string;
  /**
   * A turn that was created on the previous screen and has not been dispatched
   * yet — the handoff from the empty arena, which creates the thread and then
   * navigates here. Null on an ordinary visit, and it must stay null on a
   * reload, or re-opening a thread would silently re-ask its last question.
   */
  readonly pendingTurn: {
    readonly id: string;
    readonly ordinal: number;
    readonly prompt: string;
  } | null;
};

const seed = (
  pending: ArenaInput["pendingTurn"],
  modelIds: readonly string[],
): readonly LiveTurn[] => {
  if (pending === null) return [];
  const at = performance.now();
  return [
    {
      id: pending.id,
      ordinal: pending.ordinal,
      prompt: pending.prompt,
      modelIds,
      responses: new Map(
        modelIds.map((modelId) => [
          modelId,
          {
            modelId,
            text: "",
            startedAt: at,
            firstDeltaAt: null,
            lastDeltaAt: null,
            finishedAt: null,
            deltaCount: 0,
            metrics: null,
            failure: null,
          },
        ]),
      ),
    },
  ];
};

export const useArena = (input: ArenaInput) => {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  // Seeded during the first render rather than from an effect: the pending turn
  // is already known, and mirroring a prop into state afterwards is the
  // cascading-render shape this project has had to unpick three times.
  const [liveTurns, dispatch] = useReducer(liveReducer, input.pendingTurn, (pending) =>
    seed(pending, input.modelIds),
  );
  const [votes, setVotes] = useState<ReadonlyMap<string, Vote>>(new Map());
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tickMs, setTickMs] = useState(() => performance.now());

  const controllers = useRef(new Map<string, AbortController>());
  const dispatched = useRef(false);

  const streamOne = useCallback(
    async (turnId: string, modelId: string, restart: boolean): Promise<void> => {
      const key = `${turnId}:${modelId}`;
      controllers.current.get(key)?.abort();

      const controller = new AbortController();
      controllers.current.set(key, controller);

      if (restart) dispatch({ type: "dispatched", turnId, modelId, at: performance.now() });

      for await (const event of streamModelCall(
        { turnId, modelId },
        { signal: controller.signal },
      )) {
        const at = performance.now();
        if (event.type === "delta") {
          dispatch({ type: "delta", turnId, modelId, text: event.text, at });
        } else if (event.type === "done") {
          dispatch({ type: "done", turnId, modelId, metrics: event.metrics, at });
        } else if (event.type === "error") {
          dispatch({ type: "failed", turnId, modelId, failure: event.failure, at });
        }
      }

      controllers.current.delete(key);
    },
    [],
  );

  const runTurn = useCallback(
    (turnId: string): void => {
      void Promise.all(input.modelIds.map((modelId) => streamOne(turnId, modelId, false))).then(
        () => {
          // Once the turn has settled the server knows things this screen does
          // not — the sidebar's turn count, and the standings if a vote landed
          // meanwhile. Refreshing here rather than per event keeps it to one.
          router.refresh();
        },
      );
    },
    [input.modelIds, router, streamOne],
  );

  // The handoff. The empty arena creates the thread and navigates here with the
  // new turn's id, because a navigation would have torn down any request
  // started before it. The id is then stripped from the URL so that reloading
  // this page is an ordinary visit and never re-asks anything.
  useEffect(() => {
    const pending = input.pendingTurn;
    if (pending === null || dispatched.current) return;
    dispatched.current = true;

    runTurn(pending.id);
    window.history.replaceState(null, "", `/thread/${input.threadId}`);
  }, [input.pendingTurn, input.threadId, runTurn]);

  // Everything still in flight is abandoned when this screen goes away. The
  // server notices the disconnect and stops its own call, so a closed tab does
  // not leave three models talking to nobody.
  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
    },
    [],
  );

  const running = anyRunning(liveTurns);

  useEffect(() => {
    if (!running || reducedMotion) return;

    let frame = requestAnimationFrame(function tick() {
      setTickMs(performance.now());
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [running, reducedMotion]);

  const nowMs = reducedMotion ? lastEventAt(liveTurns) : tickMs;

  const turns = useMemo(() => {
    const live = liveTurns.map((turn) => liveTurnView(turn, input.nameOf, nowMs));
    return mergeTurns(input.storedTurns, live).map((turn) => {
      const winner = votes.get(turn.id)?.winnerModelId;
      return winner === undefined ? turn : { ...turn, winnerModelId: winner };
    });
  }, [liveTurns, input.storedTurns, input.nameOf, nowMs, votes]);

  const send = useCallback(
    async (prompt: string): Promise<boolean> => {
      setSending(true);
      setSendError(null);

      const result = await startTurn({
        threadId: input.threadId,
        prompt,
        modelIds: input.modelIds,
      });

      setSending(false);

      if (!result.ok) {
        setSendError(result.message);
        return false;
      }

      dispatch({
        type: "turn-started",
        id: result.turnId,
        ordinal: result.ordinal,
        prompt,
        modelIds: input.modelIds,
        at: performance.now(),
      });
      runTurn(result.turnId);
      return true;
    },
    [input.modelIds, input.threadId, runTurn],
  );

  const retry = useCallback(
    (turnId: string, modelId: string): void => {
      void streamOne(turnId, modelId, true).then(() => {
        router.refresh();
      });
    },
    [router, streamOne],
  );

  const pick = useCallback(
    (turnId: string, modelId: string): void => {
      // Marked straight away, and unmarked again if the server refuses. A vote
      // is one row against rules the browser cannot check for itself, so the
      // sentence that comes back is the one shown.
      setVotes((current) => new Map(current).set(turnId, { winnerModelId: modelId }));

      void pickWinner({ turnId, modelId }).then((result) => {
        if (result.ok) {
          router.refresh();
          return;
        }
        setVotes((current) => new Map(current).set(turnId, { message: result.message }));
      });
    },
    [router],
  );

  const voteMessages = useMemo(
    () =>
      new Map(
        [...votes].flatMap(([turnId, vote]): readonly (readonly [string, string])[] =>
          vote.message === undefined ? [] : [[turnId, vote.message]],
        ),
      ),
    [votes],
  );

  return {
    turns,
    voteMessages,
    sending,
    sendError,
    send,
    retry,
    pick,
  };
};
