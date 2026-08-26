import type { Standing } from "@/features/thread/types";

import { CopyLink } from "./copy-link";
import { ThreadStandings } from "./standings";

/**
 * What the top bar shows once a thread is open: its name, and how it has gone.
 *
 * The name is a real `h1` rather than another breadcrumb crumb. It is the
 * heading of the screen underneath, the screen itself has no other one, and a
 * page whose only heading is a nav item is a page a screen reader cannot
 * summarise.
 *
 * Copy-link sits out here rather than down in the page because this is where
 * the thread exists as a thing you can hand to someone, instead of as content
 * you are scrolling through. It is last in the bar, after the standings, so the
 * reading order is what this thread is, how it has gone, and then what you can
 * do with it.
 */

type ThreadBarProps = {
  readonly threadId: string;
  readonly title: string;
  readonly standings: readonly Standing[];
};

export const ThreadBar = ({ threadId, title, standings }: ThreadBarProps) => (
  <>
    <span aria-hidden="true" className="shrink-0 text-ink-muted">
      /
    </span>
    <h1 className="min-w-0 truncate text-detail font-medium text-ink">{title}</h1>
    <ThreadStandings standings={standings} className="ml-auto" />
    <CopyLink threadId={threadId} />
  </>
);
