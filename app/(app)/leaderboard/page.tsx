import type { Metadata } from "next";

import { WinRate } from "@/features/design/win-rate";
import { ModelMark } from "@/features/design/model-mark";
import { formatMs, formatTokensPerSecond } from "@/features/design/format";
import { PlaceholderNote } from "@/features/shell/placeholder-note";

/**
 * The leaderboard, framed and styled, on fixture rows.
 *
 * The numbers are fake; the components printing them are not. `WinRate` is the
 * real one, so the rule that a rate never appears without the count behind it —
 * and that a model nobody has judged shows an em dash rather than 0% — already
 * holds here. Feature 9 replaces the rows with aggregates over real votes and
 * nothing about this screen has to change.
 */

export const metadata: Metadata = {
  title: "Leaderboard — LLM Arena",
};

type Row = {
  readonly modelId: string;
  readonly modelName: string;
  readonly won: number;
  readonly judged: number;
  readonly avgTimeToFirstTokenMs: number | null;
  readonly avgTokensPerSecond: number | null;
};

const FIXTURE_ROWS: readonly Row[] = [
  {
    modelId: "google/gemma-4-31b-it:free",
    modelName: "Gemma 4 31B",
    won: 507,
    judged: 700,
    avgTimeToFirstTokenMs: 1186,
    avgTokensPerSecond: 57,
  },
  {
    modelId: "qwen/qwen3-14b:free",
    modelName: "Qwen3 14B",
    won: 148,
    judged: 700,
    avgTimeToFirstTokenMs: 2410,
    avgTokensPerSecond: 41,
  },
  {
    modelId: "meta-llama/llama-3.3-8b-instruct:free",
    modelName: "Llama 3.3 8B",
    won: 0,
    judged: 0,
    avgTimeToFirstTokenMs: null,
    avgTokensPerSecond: null,
  },
];

export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-8 sm:px-4">
      <div>
        <h1 className="text-display font-semibold tracking-tight text-ink">Leaderboard</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">
          Every model&rsquo;s real record, from actual head-to-head votes. No cost column — every
          model here is free tier, so it would never mean anything.
        </p>
      </div>

      <PlaceholderNote>
        These rows are made up. Real standings need votes, which arrive once prompts can actually be
        sent.
      </PlaceholderNote>

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-left">
            <thead>
              <tr className="border-b border-line bg-surface-raised">
                <th scope="col" className="px-4 py-2 eyebrow font-normal text-ink-muted">
                  #
                </th>
                <th scope="col" className="px-4 py-2 eyebrow font-normal text-ink-muted">
                  Model
                </th>
                <th scope="col" className="px-4 py-2 eyebrow font-normal text-ink-muted">
                  Win rate
                </th>
                <th scope="col" className="px-4 py-2 text-right eyebrow font-normal text-ink-muted">
                  Avg. to first token
                </th>
                <th scope="col" className="px-4 py-2 text-right eyebrow font-normal text-ink-muted">
                  Avg. tokens/sec
                </th>
              </tr>
            </thead>
            <tbody>
              {FIXTURE_ROWS.map((row, index) => (
                <tr
                  key={row.modelId}
                  /* First place gets a subtle highlight. Nobody else does. */
                  className={index === 0 ? "bg-surface-raised/50" : undefined}
                >
                  <td className="px-4 py-3 measured text-detail text-ink-muted">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <ModelMark modelId={row.modelId} />
                      <span className="text-detail text-ink">{row.modelName}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <WinRate won={row.won} judged={row.judged} />
                  </td>
                  <td className="px-4 py-3 text-right measured text-detail text-ink">
                    {formatMs(row.avgTimeToFirstTokenMs)}
                  </td>
                  <td className="px-4 py-3 text-right measured text-detail text-ink">
                    {formatTokensPerSecond(row.avgTokensPerSecond)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
