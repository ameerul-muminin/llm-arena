import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModelCallFailure, ModelMetrics } from "@/features/model-call/types";
import { cn } from "@/lib/utils";
import { MetricsRow } from "./metrics-row";
import { ModelMark } from "./model-mark";
import { TimeAxis, type AxisSpan } from "./time-axis";

/**
 * One model's answer, in every state it can honestly be in. Presentational
 * only — it renders what it is given and computes nothing, so the card, the
 * leaderboard, and PostHog cannot drift apart.
 *
 * A failed call keeps its card. Removing it would quietly reshuffle the grid
 * mid-turn and lose the fact that this model was asked at all, which is exactly
 * the information a leaderboard about reliability needs to keep.
 *
 * The winner is never signalled by colour alone: the badge carries the word.
 */

export type AnswerState =
  | { readonly status: "waiting" }
  | { readonly status: "streaming"; readonly text: string }
  | { readonly status: "done"; readonly text: string; readonly metrics: ModelMetrics }
  | { readonly status: "failed"; readonly failure: ModelCallFailure };

type AnswerCardProps = {
  readonly modelId: string;
  readonly modelName: string;
  readonly state: AnswerState;
  readonly span: AxisSpan;
  /** The turn's shared time scale. Every card in a turn gets the same value. */
  readonly scaleMs: number;
  readonly isWinner?: boolean;
  /** Picking only exists once two or more models have actually answered. */
  readonly canPick?: boolean;
  readonly onPick?: () => void;
  readonly onRetry?: () => void;
  readonly className?: string;
};

const WaitingBody = () => (
  <div className="space-y-2" aria-hidden="true">
    <Skeleton className="h-3 w-[92%]" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-[64%]" />
  </div>
);

export const AnswerCard = ({
  modelId,
  modelName,
  state,
  span,
  scaleMs,
  isWinner = false,
  canPick = false,
  onPick,
  onRetry,
  className,
}: AnswerCardProps) => {
  const metrics = state.status === "done" ? state.metrics : null;

  return (
    <Card
      className={cn("h-full ring-1 ring-line", isWinner && "ring-[1.5px] ring-win/70", className)}
    >
      <CardHeader className="flex items-center gap-2">
        <ModelMark modelId={modelId} />
        <h3 className="min-w-0 flex-1 truncate text-detail font-medium text-ink">{modelName}</h3>

        <CardAction>
          {isWinner ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-win/40 bg-win/10 px-2 py-0.5 text-micro font-medium text-win">
              <Check className="size-3" aria-hidden="true" />
              Winner
            </span>
          ) : (
            canPick &&
            state.status === "done" && (
              <Button size="xs" onClick={onPick}>
                Pick this answer
              </Button>
            )
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1">
        {state.status === "waiting" && <WaitingBody />}

        {(state.status === "streaming" || state.status === "done") && (
          <p
            className={cn(
              "text-body leading-relaxed break-words whitespace-pre-wrap text-ink",
              state.status === "streaming" &&
                "after:ml-0.5 after:inline-block after:h-[1em] after:w-[2px] after:translate-y-[0.15em] after:animate-pulse after:bg-rust after:content-['']",
            )}
          >
            {state.text}
          </p>
        )}

        {state.status === "failed" && (
          <div className="space-y-3">
            {/* The plain sentence from `failures.ts`. Provider text never gets here. */}
            <p className="text-body leading-relaxed text-fail">{state.failure.message}</p>
            {state.failure.retryable && (
              <Button size="xs" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        <TimeAxis span={span} scaleMs={scaleMs} />
        <MetricsRow metrics={metrics} />
      </CardFooter>
    </Card>
  );
};
