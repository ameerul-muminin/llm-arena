import "server-only";

/**
 * Every read of a thread. Effects live here and in `writes.ts`; everything else
 * in this feature is pure.
 *
 * Reads deliberately do not filter by owner. Feature 8's rule is that a thread
 * is readable by anyone with the link and only sending or voting needs an
 * account, so authorisation is the writes' job. A read that quietly filtered by
 * owner would make a shared link return "not found" for the person it was
 * shared with.
 */

import { prisma } from "@/lib/prisma";

import { toStoredThread } from "./mappers";
import { titleFor } from "./title";
import type { StoredThread, ThreadListRow } from "./types";

/**
 * Turns in the order they were asked, and responses in a fixed order so the
 * arena's columns do not shuffle between page loads. Sorting by `modelId` is
 * arbitrary but stable, which is the property that matters.
 */
const THREAD_INCLUDE = {
  turns: {
    orderBy: { ordinal: "asc" },
    include: {
      responses: { orderBy: { modelId: "asc" } },
      vote: { select: { winningResponseId: true } },
    },
  },
} as const;

export const findThread = async (id: string): Promise<StoredThread | null> => {
  const row = await prisma.thread.findUnique({ where: { id }, include: THREAD_INCLUDE });
  return row === null ? null : toStoredThread(row);
};

/**
 * Feature 7's sidebar. Never the answers — a row is a title, the models that
 * were in the thread, and how many turns it ran.
 *
 * The first turn is read for its prompt alone, which is the title fallback for
 * a thread nobody has named. The models come off the thread's own stored
 * line-up rather than being gathered from response rows, so a thread whose
 * first prompt was refused before it reached anyone still shows who it was
 * going to ask.
 */
export const listThreadsForOwner = async (
  ownerId: string,
  take: number,
): Promise<readonly ThreadListRow[]> => {
  const rows = await prisma.thread.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      _count: { select: { turns: true } },
      turns: { orderBy: { ordinal: "asc" }, take: 1, select: { prompt: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: titleFor(row.title, row.turns.at(0)?.prompt ?? null),
    modelIds: row.modelIds,
    turnCount: row._count.turns,
  }));
};

/**
 * The stored id of one model's answer to one turn.
 *
 * Voting names a turn and a model, never a response id — the browser is never
 * told one, because putting it on the wire would mean teaching the model-call
 * event union that threads exist, and that dependency is only allowed to run
 * the other way. The unique index on (turn, model) is what makes resolving it
 * here exact rather than a search.
 */
export const findResponseId = async (turnId: string, modelId: string): Promise<string | null> => {
  const row = await prisma.modelResponse.findUnique({
    where: { turnId_modelId: { turnId, modelId } },
    select: { id: true },
  });
  return row?.id ?? null;
};

/**
 * Who owns the thread a turn belongs to. The cheap check a route makes before
 * it spends anything on a model call, so an unauthorised write is refused
 * before the work rather than after it.
 */
export const findTurnOwner = async (
  turnId: string,
): Promise<{ readonly threadId: string; readonly ownerId: string } | null> => {
  const row = await prisma.turn.findUnique({
    where: { id: turnId },
    select: { threadId: true, thread: { select: { ownerId: true } } },
  });
  return row === null ? null : { threadId: row.threadId, ownerId: row.thread.ownerId };
};
