/**
 * The board itself.
 *
 * Lifted out of the page nearly unchanged in look — feature 4 built and framed
 * this table on fixture rows, and its own note promised that feature 9 would
 * replace the rows and nothing about the screen would have to change. It held,
 * with one exception recorded in scope: the speed column now reads the
 * end-to-end figure rather than the generation one, and is labelled the way
 * `MetricsRow` labels the same measurement, so a reader who has seen an answer
 * card already knows which of the two speeds this is.
 *
 * `WinRate` is doing the load-bearing honesty here and needs no help: the rate
 * never appears without the count behind it, and a model nobody has judged shows
 * an em dash rather than a zero. That is what makes ranking on a bare rate safe
 * at these vote counts — see `ranking.ts`.
 */

import { EM_DASH, formatMs, formatTokensPerSecond } from "@/features/design/format";
import { ModelMark } from "@/features/design/model-mark";
import { WinRate } from "@/features/design/win-rate";
import { cn } from "@/lib/utils";

import type { LeaderboardRow } from "./types";

type LeaderboardTableProps = {
  readonly rows: readonly LeaderboardRow[];
  /** Names the board, so the table is announced as the one being looked at. */
  readonly caption: string;
};

const HeaderCell = ({
  children,
  numeric = false,
}: {
  readonly children: string;
  readonly numeric?: boolean;
}) => (
  <th
    scope="col"
    className={cn("px-4 py-2 eyebrow font-normal text-ink-muted", numeric && "text-right")}
  >
    {children}
  </th>
);

/**
 * A measured cell, muted when there is no number. The same treatment
 * `MetricsRow` gives an em dash: it is a real answer rather than missing text,
 * but it should not read with the weight of a measurement.
 */
const MeasuredCell = ({ value }: { readonly value: string }) => (
  <td
    className={cn(
      "px-4 py-3 text-right measured text-detail",
      value === EM_DASH ? "text-ink-muted" : "text-ink",
    )}
  >
    {value}
  </td>
);

export const LeaderboardTable = ({ rows, caption }: LeaderboardTableProps) => (
  <div className="overflow-hidden rounded-xl border border-line">
    <div className="overflow-x-auto">
      <table className="w-full min-w-2xl text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-raised">
            <HeaderCell>#</HeaderCell>
            <HeaderCell>Model</HeaderCell>
            <HeaderCell>Win rate</HeaderCell>
            <HeaderCell numeric>Avg. to first token</HeaderCell>
            <HeaderCell numeric>Avg. overall tokens/sec</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.modelId}
              /* First place gets a subtle highlight. Nobody else does. */
              className={row.place === 1 ? "bg-surface-raised/50" : undefined}
            >
              <td className="px-4 py-3 measured text-detail text-ink-muted">{row.place}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <ModelMark modelId={row.modelId} />
                  <span className="text-detail text-ink">{row.modelName}</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <WinRate won={row.won} judged={row.judged} />
              </td>
              <MeasuredCell value={formatMs(row.avgTimeToFirstTokenMs)} />
              <MeasuredCell value={formatTokensPerSecond(row.avgEndToEndTokensPerSecond)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
