"use client";

import { AnswerCard } from "@/features/design/answer-card";
import { axisScaleFor } from "@/features/design/time-axis";

import { answeredCount } from "./live";
import type { TurnView } from "./view";

/**
 * One prompt and every model's answer to it, on one shared time scale.
 *
 * The scale is this turn's own slowest finisher, recomputed as the turn runs,
 * which is what makes three cards side by side a race chart rather than three
 * unrelated progress bars. It is the signature feature 4 committed to, and the
 * only thing that must survive the reflow to a single column on a phone.
 *
 * Picking is gated on two models having genuinely answered, because below that
 * there is nothing to compare — the same rule the database enforces on the
 * write, stated here so the control is simply not offered rather than offered
 * and then refused.
 */

const MIN_ANSWERS_TO_VOTE = 2;

type TurnBoardProps = {
  readonly turn: TurnView;
  /** Only a thread's owner can vote in it, so only they see the control. */
  readonly canVote: boolean;
  /** A refused vote's plain sentence. */
  readonly voteMessage?: string;
  readonly onPick: (modelId: string) => void;
  readonly onRetry: (modelId: string) => void;
};

export const TurnBoard = ({ turn, canVote, voteMessage, onPick, onRetry }: TurnBoardProps) => {
  const scaleMs = axisScaleFor(turn.responses.map((response) => response.span));
  const judged = turn.winnerModelId !== null;
  const canPick = canVote && !judged && answeredCount(turn) >= MIN_ANSWERS_TO_VOTE;

  return (
    <section className="space-y-4" aria-label={`Prompt ${String(turn.ordinal + 1)}`}>
      <div className="flex justify-end">
        <p className="max-w-lg rounded-xl border border-line bg-surface-raised px-4 py-2 text-body break-words whitespace-pre-wrap text-ink">
          {turn.prompt}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {turn.responses.map((response) => (
          <AnswerCard
            key={response.modelId}
            modelId={response.modelId}
            modelName={response.modelName}
            state={response.state}
            span={response.span}
            scaleMs={scaleMs}
            isWinner={turn.winnerModelId === response.modelId}
            canPick={canPick}
            onPick={() => {
              onPick(response.modelId);
            }}
            onRetry={() => {
              onRetry(response.modelId);
            }}
          />
        ))}
      </div>

      {voteMessage !== undefined && (
        <p role="status" className="text-detail text-fail">
          {voteMessage}
        </p>
      )}
    </section>
  );
};
