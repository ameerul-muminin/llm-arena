import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ThreadArena } from "@/features/arena/thread-arena";
import { storedTurnViews } from "@/features/arena/view";
import { getFreeModels } from "@/features/catalogue/catalogue";
import { namerFor } from "@/features/catalogue/naming";
import { guardThreadRead } from "@/features/shell/guard-read";
import { findThread } from "@/features/thread/queries";
import { threadTitle } from "@/features/thread/title";

/**
 * One thread, readable by anyone with the link.
 *
 * The read deliberately does not filter by owner — that is feature 8's rule and
 * what makes a link worth sharing — so authorisation lives on the writes, not
 * here. A thread that does not exist and one that was deleted are the same
 * plain not-found page either way.
 *
 * **Readable by link, and deliberately not indexable.** "Anyone with the link"
 * and "anyone searching" are different promises, and sharing a link is not
 * consent to filing the conversation in a search index. Thread ids are
 * unguessable, so the link genuinely is the key, and `noindex` is what keeps it
 * the key. It is set here and nowhere else — the arena, the leaderboard, and the
 * models list are the product and stay indexable.
 *
 * `?live=<turnId>` is the handoff from the empty arena: a turn that has just
 * been created and has not been sent to anyone yet. It is honoured only for the
 * owner, and only while that turn genuinely has no answers, so it cannot be
 * pasted at a finished thread to make it re-ask its last question.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/thread/[id]">): Promise<Metadata> {
  // Guarded here as well as in the page, because this is often the first of the
  // three entry points to reach the database. Deduped per request, so all three
  // guarding still costs one decision and one token.
  await guardThreadRead();

  const { id } = await params;
  const thread = await findThread(id);
  return {
    title: thread === null ? "Thread — LLM Arena" : `${threadTitle(thread)} — LLM Arena`,
    robots: { index: false, follow: false },
  };
}

export default async function ThreadPage({ params, searchParams }: PageProps<"/thread/[id]">) {
  await guardThreadRead();

  const { id } = await params;
  const thread = await findThread(id);
  if (thread === null) notFound();

  const [catalogue, { userId }, query] = await Promise.all([getFreeModels(), auth(), searchParams]);

  const nameOf = namerFor(catalogue);
  const isOwner = userId !== null && userId === thread.ownerId;

  const live = typeof query.live === "string" ? query.live : null;
  const pending = thread.turns.find(
    (turn) => turn.id === live && turn.responses.length === 0 && isOwner,
  );

  return (
    <ThreadArena
      catalogue={catalogue}
      threadId={thread.id}
      lineUp={thread.modelIds.map((modelId) => ({ modelId, modelName: nameOf(modelId) }))}
      storedTurns={storedTurnViews(thread, nameOf)}
      pendingTurn={
        pending === undefined
          ? null
          : { id: pending.id, ordinal: pending.ordinal, prompt: pending.prompt }
      }
      isOwner={isOwner}
    />
  );
}
