/**
 * Global or personal, as two links rather than a control with state.
 *
 * It is a `<nav>` of ordinary links because that is what it is: two addresses,
 * one of them the one you are on. That buys the middle-click, the back button,
 * and a linkable personal board for free, and it needs no client component, so
 * the right board is server-rendered on the first paint instead of flickering
 * into place after hydration.
 *
 * `aria-current="page"` rather than `aria-pressed`, for the same reason — these
 * are places, not switches. The rust tint follows the sidebar's active nav item,
 * which is the one other place in the app that marks "you are here", and rust is
 * already the colour reserved for the things you interact with.
 *
 * Rendered only for a signed-in reader. A Personal tab a signed-out visitor
 * cannot use is the dead control feature 8's review fix wrote up — a control
 * shown to everyone that only works for some.
 */

import Link from "next/link";

import { cn } from "@/lib/utils";

import { SCOPE_HREF } from "./scope";
import type { BoardScope } from "./scope";

const TABS: readonly { readonly scope: BoardScope; readonly label: string }[] = [
  { scope: "global", label: "Global" },
  { scope: "personal", label: "Personal" },
];

type ScopeToggleProps = {
  readonly current: BoardScope;
};

export const ScopeToggle = ({ current }: ScopeToggleProps) => (
  <nav aria-label="Which leaderboard">
    <ul className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface p-1">
      {TABS.map((tab) => {
        const active = tab.scope === current;

        return (
          <li key={tab.scope}>
            <Link
              href={SCOPE_HREF[tab.scope]}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-1 text-detail transition-colors",
                active
                  ? "bg-surface-raised font-medium text-rust"
                  : "text-ink-muted hover:bg-surface-raised hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);
