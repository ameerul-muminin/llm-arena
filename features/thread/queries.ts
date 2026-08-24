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

import { toStoredThread, toThreadSummary } from "./mappers";
import type { StoredThread, ThreadSummary } from "./types";

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

/** Feature 7's sidebar. Summaries only — a sidebar never needs the answers. */
export const listThreadsForOwner = async (
  ownerId: string,
  take: number,
): Promise<readonly ThreadSummary[]> => {
  const rows = await prisma.thread.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toThreadSummary);
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
