import "server-only";

/**
 * The whole leaderboard, in one batched read.
 *
 * This is the only file in the feature that touches the database; ranking,
 * naming, and every sentence on the screen are pure and live next door.
 *
 * **Three grouped aggregates rather than one raw query.** Postgres could answer
 * this in a single statement with conditional counts, and `$queryRaw` would hand
 * the rows back as something this project would then have to hand-type — a type
 * asserting what the SQL returns with nothing checking the assertion, which
 * under the no-`any` rule is the worse trade. Three narrow aggregates against
 * `@@index([modelId])` is the cheaper mistake.
 *
 * **They are batched in a transaction at `RepeatableRead`, and the isolation
 * level is the half that does the work.** Not for speed — for agreement. A vote
 * landing between the second read and the third would produce a row claiming
 * more wins than judged turns: a rate above 100%, printed as "won 3 of 2", and
 * sorted to the top of the board for being the best score on it.
 *
 * A transaction alone does not prevent that, which is what an earlier version of
 * this comment claimed. Postgres defaults to `READ COMMITTED`, where every
 * *statement* takes a fresh snapshot — so three statements in one transaction
 * can legitimately see three different states of the table. Verified against
 * this database rather than argued: two identical counts either side of another
 * connection's commit returned 0 and then 1 inside a single `READ COMMITTED`
 * transaction, and 1 and 1 under `REPEATABLE READ`, which snapshots once at the
 * first statement and holds it.
 *
 * `RepeatableRead` and not `Serializable`: these are pure reads, so there is
 * nothing to serialise against, and a read-only `REPEATABLE READ` transaction in
 * Postgres cannot raise a serialisation failure — which is why this needs no
 * retry around it.
 *
 * **Scoping is one filter applied to all three.** Personal means threads this
 * person owns. It could equally have been keyed on `Vote.voterId`, and those are
 * provably the same rows — `castVote` refuses anyone who is not the thread's
 * owner, so no vote exists that the two would disagree about. Owner wins because
 * the speed averages have no voter to be keyed on, and using one filter for the
 * whole row means the record and the speeds describe the same set of calls
 * rather than two overlapping ones.
 */

import { unstable_cache } from "next/cache";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { ModelTally } from "./types";

/**
 * The tag a vote busts. Exported so `pickWinner` names the same string this
 * file does, rather than the two agreeing by someone typing it twice.
 */
export const LEADERBOARD_TAG = "leaderboard";

/**
 * How long a stale global board is acceptable for, if no vote lands to bust it.
 * A backstop rather than the primary mechanism — a vote revalidates the tag
 * immediately, so this only covers a write that happened some other way.
 */
const BOARD_MAX_AGE_SECONDS = 60;

/**
 * Only answered responses count anywhere on this screen. A failed call has no
 * metrics to average and was never in a comparison to win, so including it would
 * add nothing but a denominator that punishes a model for breaking.
 */
const ANSWERED = { status: "ANSWERED" } as const;

/**
 * Restricts a response to one person's own threads, or to nothing in
 * particular. An empty filter is how "everyone's" is spelled, so all three
 * queries below take the same shape either way.
 */
const inThreadsOwnedBy = (ownerId: string | null): Prisma.TurnWhereInput =>
  ownerId === null ? {} : { thread: { ownerId } };

/**
 * Answered responses, grouped by model, counted.
 *
 * Ordered by slug because Prisma requires an order on a grouped read, and this
 * is the one that is stable rather than incidental — the ranking happens later,
 * in a pure function, over all three results at once.
 */
const countByModel = (where: Prisma.ModelResponseWhereInput) =>
  prisma.modelResponse.groupBy({
    by: ["modelId"],
    orderBy: { modelId: "asc" },
    where: { ...ANSWERED, ...where },
    _count: true,
  });

/**
 * The same, plus the two averages.
 *
 * A separate function rather than an optional argument, because `_avg:
 * undefined` is not the same as no `_avg` at all — Prisma still emits the
 * selection and the query engine rejects it as empty at runtime. That was
 * written as one generic helper first, and it typechecked, linted, and built
 * cleanly before failing on the first real request.
 */
const measureByModel = (where: Prisma.ModelResponseWhereInput) =>
  prisma.modelResponse.groupBy({
    by: ["modelId"],
    orderBy: { modelId: "asc" },
    where: { ...ANSWERED, ...where },
    _count: true,
    _avg: { timeToFirstTokenMs: true, endToEndTokensPerSecond: true },
  });

/**
 * Every model that has ever answered a prompt, with its record and its speeds.
 *
 * Models are drawn from the answered responses rather than from the catalogue.
 * Listing the catalogue would be some sixty rows of em dashes, and a model that
 * has only ever failed has nothing measured to put in any column — that is not
 * "no votes yet", it is no data at all, and the two should not look alike.
 *
 * @param ownerId Restricts to this person's own threads; `null` for everyone's.
 */
export const tallyModels = async (ownerId: string | null): Promise<readonly ModelTally[]> => {
  const turn = inThreadsOwnedBy(ownerId);

  const [answered, judged, won] = await prisma.$transaction(
    [
      measureByModel({ turn }),
      // `isNot: null` is "this turn was judged". What the vote actually says does
      // not matter here — only that one exists.
      countByModel({ turn: { ...turn, vote: { isNot: null } } }),
      // The back-reference from the composite key on `Vote`, so this reads "a vote
      // points at this exact response", not "a vote exists on this turn".
      countByModel({ turn, wonVote: { isNot: null } }),
    ],
    // One snapshot across all three. See the note at the top of this file: the
    // transaction is not what makes these three agree, this is.
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  const judgedBy = new Map(judged.map((group) => [group.modelId, group._count]));
  const wonBy = new Map(won.map((group) => [group.modelId, group._count]));

  return answered.map((group) => ({
    modelId: group.modelId,
    answered: group._count,
    judged: judgedBy.get(group.modelId) ?? 0,
    won: wonBy.get(group.modelId) ?? 0,
    avgTimeToFirstTokenMs: group._avg.timeToFirstTokenMs,
    avgEndToEndTokensPerSecond: group._avg.endToEndTokensPerSecond,
  }));
};

/**
 * The global board, shared across every visitor rather than recomputed for each
 * one. Feature 10's structural half, and the part that matters more than the
 * rate limit in front of it.
 *
 * Signed-out leaderboard output is byte-identical for everybody, so an
 * unauthenticated flood was one cheap request turning into three aggregates
 * over the whole response table, every single time. Cached, it turns into
 * three aggregates *once*, and asking a remote service for permission to run
 * the same three queries again is strictly worse than not running them.
 *
 * **Only the global board.** The personal one is behind an account, so it is
 * not the anonymous vector, and leaving it live means the person most likely to
 * have just voted sees their own vote immediately — which is exactly who is
 * looking. Caching it would also mean one entry per user for no benefit.
 *
 * `unstable_cache` rather than `"use cache"`, because the latter needs
 * `cacheComponents` turned on for the whole app, and a hardening pass is the
 * wrong moment to change how every route in the project is rendered.
 */
export const tallyModelsGlobal = unstable_cache(async () => tallyModels(null), ["leaderboard"], {
  tags: [LEADERBOARD_TAG],
  revalidate: BOARD_MAX_AGE_SECONDS,
});
