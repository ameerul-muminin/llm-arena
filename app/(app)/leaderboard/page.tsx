import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { getFreeModels } from "@/features/catalogue/catalogue";
import { namerFor } from "@/features/catalogue/naming";
import {
  BOARD_BLURB,
  BOARD_HEADING,
  NOTHING_ANSWERED,
  NOTHING_JUDGED,
} from "@/features/leaderboard/copy";
import { tallyModels } from "@/features/leaderboard/queries";
import { anyJudged, rankModels } from "@/features/leaderboard/ranking";
import { parseScope } from "@/features/leaderboard/scope";
import { ScopeToggle } from "@/features/leaderboard/scope-toggle";
import { LeaderboardTable } from "@/features/leaderboard/table";

/**
 * Every model's real record, over real votes.
 *
 * The screen was built on fixtures by feature 4 and framed exactly like this;
 * what changed is where the rows come from and which speed the last column
 * holds. Both boards are the same aggregate with a different scope, so there is
 * one query, one ranking, and one table here rather than two of each.
 *
 * The personal board is decided by the URL and read from the signed-in user on
 * the server. `parseScope` will not return `personal` for a signed-out visitor,
 * and the query is handed an owner id or nothing — so the parameter cannot
 * scope a board to somebody it does not belong to even if it is typed by hand.
 */

export const metadata: Metadata = {
  title: "Leaderboard — LLM Arena",
};

/*
 * Rendered per request for two reasons that both matter. The catalogue's retry
 * has to be real, which is measured and written down in
 * `features/catalogue/catalogue.ts`. And these are live vote counts — a board
 * rendered once at build time would serve yesterday's standings as though they
 * were today's, which is the one thing this screen cannot do.
 */
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams]);
  const scope = parseScope(params.scope, userId !== null);

  const [catalogue, tallies] = await Promise.all([
    getFreeModels(),
    tallyModels(scope === "personal" ? userId : null),
  ]);

  const rows = rankModels(tallies, namerFor(catalogue));
  const heading = BOARD_HEADING[scope];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-8 sm:px-4">
      <div>
        <h1 className="text-display font-semibold tracking-tight text-ink">Leaderboard</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">{BOARD_BLURB}</p>
      </div>

      {/* Only a signed-in reader has a personal board to switch to. */}
      {userId !== null && <ScopeToggle current={scope} />}

      <section className="space-y-4">
        <div>
          <h2 className="text-title font-medium text-ink">{heading.title}</h2>
          <p className="mt-1 text-detail text-ink-muted">{heading.note}</p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-3 text-detail text-ink-muted">
            {NOTHING_ANSWERED[scope]}
          </p>
        ) : (
          <>
            {/*
             * Answers but no votes is a real state and needs saying. Without
             * this the whole win-rate column is em dashes with nothing
             * explaining them, which reads as broken rather than as early.
             */}
            {!anyJudged(rows) && (
              <p className="rounded-lg border border-line bg-surface px-4 py-3 text-detail text-ink-muted">
                {NOTHING_JUDGED[scope]}
              </p>
            )}

            <LeaderboardTable rows={rows} caption={heading.title} />
          </>
        )}
      </section>
    </div>
  );
}
