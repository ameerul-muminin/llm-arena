"use client";

import { useCallback } from "react";

import { modelNameFor } from "@/features/catalogue/naming";
import type { Catalogue } from "@/features/catalogue/types";

import { Composer, type LineUpModel } from "./composer";
import { TurnBoard } from "./turn-board";
import { useArena } from "./use-arena";
import type { TurnView } from "./view";

/**
 * A thread, live.
 *
 * Turns that were stored arrive already rendered as views from the server; the
 * turn happening right now is assembled in the browser from three independent
 * streams. Both are the same shape by the time they reach a card, which is why
 * a page that has been reloaded mid-thread looks exactly like one that never
 * was.
 *
 * Reading a thread needs no account — that is what makes a link worth sharing —
 * so a visitor who does not own this one gets everything except the controls
 * that would write to it.
 */

type ThreadArenaProps = {
  readonly catalogue: Catalogue;
  readonly threadId: string;
  readonly lineUp: readonly LineUpModel[];
  readonly storedTurns: readonly TurnView[];
  readonly pendingTurn: {
    readonly id: string;
    readonly ordinal: number;
    readonly prompt: string;
  } | null;
  /** Whether the person reading this is the one who started it. */
  readonly isOwner: boolean;
};

export const ThreadArena = ({
  catalogue,
  threadId,
  lineUp,
  storedTurns,
  pendingTurn,
  isOwner,
}: ThreadArenaProps) => {
  // The line-up first, then the live catalogue, then the slug itself. A thread
  // that has just been given a line-up is naming models the server has not sent
  // down yet, and a raw slug where a name belongs would be a worse answer than
  // the one the catalogue already has.
  const nameOf = useCallback(
    (modelId: string) =>
      lineUp.find((model) => model.modelId === modelId)?.modelName ??
      modelNameFor(catalogue, modelId),
    [catalogue, lineUp],
  );

  const arena = useArena({
    threadId,
    modelIds: lineUp.map((model) => model.modelId),
    storedTurns,
    nameOf,
    pendingTurn,
  });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 sm:px-4">
      <div className="flex-1 space-y-10 py-6">
        {arena.turns.map((turn) => (
          <TurnBoard
            key={turn.id}
            turn={turn}
            isOwner={isOwner}
            voteMessage={arena.voteMessages.get(turn.id)}
            onPick={(modelId) => {
              arena.pick(turn.id, modelId);
            }}
            onRetry={(modelId) => {
              arena.retry(turn.id, modelId);
            }}
          />
        ))}
      </div>

      <div className="sticky bottom-0 bg-ground/85 pt-2 pb-4 backdrop-blur-sm">
        {isOwner ? (
          <Composer
            catalogue={catalogue}
            lineUp={lineUp}
            onSend={(prompt, modelIds) => arena.send(prompt, modelIds)}
            sending={arena.sending}
            error={arena.sendError}
          />
        ) : (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-detail text-ink-muted">
            This thread belongs to someone else, so you can read it but not add to it.
          </p>
        )}
      </div>
    </div>
  );
};
