"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatWinRecord, winRate } from "@/features/design/format";
import { ModelMark } from "@/features/design/model-mark";
import { cn } from "@/lib/utils";
import type { Standing } from "@/features/thread/types";

/**
 * This thread's record, in the top bar.
 *
 * The sketch draws three pills floating side by side. Grouped into one bordered
 * cluster with hairline dividers they read as what they actually are — a single
 * readout of how this thread has gone — which is the same bench vocabulary the
 * answer cards and the time axis speak.
 *
 * Scope asks it to shrink "down to a small dot and number if it gets crowded".
 * That is a real ladder rather than an arbitrary breakpoint, and each step drops
 * the least informative thing first:
 *
 * 1. Wide — mark, short name, record.
 * 2. Medium — mark and record. The name goes first, because the mark already
 *    identifies the model.
 * 3. Narrow — one control showing the leader, opening the rest in a popover.
 *    Three records cannot be shown honestly in that width, and one legible
 *    record plus a way to see the others beats three illegible ones.
 *
 * The ladder is pure CSS. Measuring the container in JavaScript would mean a
 * first paint at the wrong step and a reflow on every resize, to arrive at the
 * same three states a media query already knows.
 *
 * Records are written as a fraction rather than a percentage because at these
 * counts a percentage is theatre: "1/2" is honest about how little has been
 * judged in a way "50%" actively hides. The full sentence goes to screen
 * readers, which get "Gemma 4 31B, won 2 of 3" rather than a bare ratio.
 */

type ThreadStandingsProps = {
  readonly standings: readonly Standing[];
  readonly className?: string;
};

const Record = ({ standing }: { readonly standing: Standing }) => (
  <>
    <span className="sr-only">
      {standing.modelName}, {formatWinRecord(standing.won, standing.judged)}
    </span>
    <span className="measured text-detail text-ink-muted" aria-hidden="true">
      {standing.won}/{standing.judged}
    </span>
  </>
);

/** The model with the best rate, which is what a single collapsed slot should show. */
const leaderOf = (standings: readonly Standing[]): Standing | undefined =>
  standings
    .filter((standing) => standing.judged > 0)
    .reduce<Standing | undefined>(
      (best, standing) =>
        best === undefined ||
        (winRate(standing.won, standing.judged) ?? 0) > (winRate(best.won, best.judged) ?? 0)
          ? standing
          : best,
      undefined,
    );

export const ThreadStandings = ({ standings, className }: ThreadStandingsProps) => {
  const leader = leaderOf(standings);

  return (
    <div className={cn("flex items-center", className)}>
      {/* Steps 1 and 2 share one cluster; only the name is dropped between them. */}
      <ul className="hidden divide-x divide-line rounded-full border border-line bg-surface md:flex">
        {standings.map((standing) => (
          <li key={standing.modelId} className="flex items-center gap-1.5 px-2.5 py-1">
            <ModelMark modelId={standing.modelId} className="size-5" />
            <span className="hidden text-detail text-ink-muted xl:inline">
              {standing.modelName}
            </span>
            <Record standing={standing} />
          </li>
        ))}
      </ul>

      {/* Step 3. */}
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-line bg-surface hover:bg-muted",
            "px-2.5 py-1 transition-colors md:hidden",
          )}
          aria-label="Show this thread's standings"
        >
          {leader === undefined ? (
            <span className="text-detail text-ink-muted">Standings</span>
          ) : (
            <>
              <ModelMark modelId={leader.modelId} className="size-5" />
              <Record standing={leader} />
            </>
          )}
        </PopoverTrigger>

        <PopoverContent align="end" className="w-64">
          <p className="eyebrow text-ink-muted">Standings in this thread</p>
          <ul className="mt-3 space-y-2">
            {standings.map((standing) => (
              <li key={standing.modelId} className="flex items-center gap-2">
                <ModelMark modelId={standing.modelId} className="size-5" />
                <span className="min-w-0 flex-1 truncate text-detail text-ink">
                  {standing.modelName}
                </span>
                <span className="measured text-detail text-ink-muted">
                  {formatWinRecord(standing.won, standing.judged)}
                </span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
};
