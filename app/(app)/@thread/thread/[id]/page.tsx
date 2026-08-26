import { getFreeModels } from "@/features/catalogue/catalogue";
import { namerFor } from "@/features/catalogue/naming";
import { findThread } from "@/features/thread/queries";
import { standingsFor } from "@/features/thread/standings";
import { threadTitle } from "@/features/thread/title";
import { guardThreadRead } from "@/features/shell/guard-read";
import { ThreadBar } from "@/features/shell/thread-bar";

/**
 * The thread's name and its standings, rendered into the top bar.
 *
 * A parallel route, because the shell layout owns the top bar and cannot see
 * which thread is open below it — the route parameter belongs to a segment
 * nested inside it. The alternative was a client store written from an effect,
 * which flashes empty on first paint and is the cascading-render shape this
 * project has already had to unpick three times. This renders on the server,
 * with the same data the page below it reads, and updates when a vote lands
 * because the vote refreshes the route.
 */

export const dynamic = "force-dynamic";

export default async function ThreadTopBarSlot({ params }: PageProps<"/thread/[id]">) {
  // A parallel slot renders independently of the page beside it, so it reaches
  // the database on its own and has to guard on its own. Deduped per request
  // with the other two entry points.
  await guardThreadRead();

  const { id } = await params;
  const thread = await findThread(id);
  if (thread === null) return null;

  const catalogue = await getFreeModels();

  return (
    <ThreadBar
      threadId={thread.id}
      title={threadTitle(thread)}
      standings={standingsFor(thread, namerFor(catalogue))}
    />
  );
}
