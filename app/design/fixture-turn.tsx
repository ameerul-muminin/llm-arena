"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AnswerCard } from "@/features/design/answer-card";
import { cn } from "@/lib/utils";
import { deriveAt, FIXTURES, FIXTURE_END_MS, FIXTURE_SCALE_MS } from "./fixtures";

/**
 * The fixture turn, running — on the design reference page, and nowhere else.
 *
 * The real arena streams for real now, so this is no longer standing in for
 * anything. It stays because it is the only way to look at the three states
 * that are awkward to catch by hand — a model that streams, one that thinks and
 * then flushes in a single chunk, and one that fails partway — all at once, on
 * demand, with a replay button. It moved out of `features/arena/` and next to
 * the page that shows it, since that page is now its only caller.
 */

type FixtureTurnProps = {
  /** Shown as the prompt this turn answered. Omitted on the design reference. */
  readonly prompt?: string;
  readonly showReplay?: boolean;
  readonly className?: string;
};

export const FixtureTurn = ({ prompt, showReplay = true, className }: FixtureTurnProps) => {
  const [nowMs, setNowMs] = useState(FIXTURE_END_MS);
  const [runId, setRunId] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    // Reduced motion gets the finished state directly. Nothing is lost — the
    // information was never in the movement.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setNowMs(FIXTURE_END_MS);
      return;
    }

    const start = performance.now();
    let frame = requestAnimationFrame(function tick() {
      const elapsed = performance.now() - start;
      setNowMs(Math.min(elapsed, FIXTURE_END_MS));
      if (elapsed < FIXTURE_END_MS) frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [runId]);

  const derived = FIXTURES.map((fixture) => ({ fixture, ...deriveAt(fixture, nowMs) }));
  const answered = derived.filter(({ state }) => state.status === "done").length;

  return (
    <div className={cn("space-y-4", className)}>
      {prompt !== undefined && (
        <div className="flex justify-end">
          <p className="max-w-lg rounded-xl border border-line bg-surface-raised px-4 py-2 text-body text-ink">
            {prompt}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {derived.map(({ fixture, state, span }) => (
          <AnswerCard
            key={fixture.modelId}
            modelId={fixture.modelId}
            modelName={fixture.modelName}
            state={state}
            span={span}
            scaleMs={FIXTURE_SCALE_MS}
            isWinner={winner === fixture.modelId}
            // Voting only exists once two or more models have actually answered.
            canPick={winner === null && answered >= 2}
            onPick={() => {
              setWinner(fixture.modelId);
            }}
          />
        ))}
      </div>

      {showReplay && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setWinner(null);
              setRunId((id) => id + 1);
            }}
          >
            Replay the turn
          </Button>
          <p className="text-detail text-ink-muted">
            All three tracks share one time scale, so the cards are a race chart drawn in place.
          </p>
        </div>
      )}
    </div>
  );
};
