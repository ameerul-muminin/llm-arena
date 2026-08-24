import type { Standing } from "@/features/thread/types";

import { ThreadStandings } from "./standings";

/**
 * What the top bar shows once a thread is open: its name, and how it has gone.
 *
 * The name is a real `h1` rather than another breadcrumb crumb. It is the
 * heading of the screen underneath, the screen itself has no other one, and a
 * page whose only heading is a nav item is a page a screen reader cannot
 * summarise.
 */

type ThreadBarProps = {
  readonly title: string;
  readonly standings: readonly Standing[];
};

export const ThreadBar = ({ title, standings }: ThreadBarProps) => (
  <>
    <span aria-hidden="true" className="shrink-0 text-ink-muted">
      /
    </span>
    <h1 className="min-w-0 truncate text-detail font-medium text-ink">{title}</h1>
    <ThreadStandings standings={standings} className="ml-auto" />
  </>
);
