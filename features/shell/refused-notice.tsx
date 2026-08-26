import Link from "next/link";

import { PageColumn } from "./page-column";

/**
 * What a request refused before it read anything says.
 *
 * Reached only through `forbidden()`, so it carries a real `403` rather than a
 * page pretending at `200` that everything was fine. It is what the two public
 * reads render when Arcjet denies them — a script hitting a shared thread in a
 * loop, or a client this app has no reason to serve.
 *
 * **Almost everyone who sees this is not a person**, which decides the copy. It
 * says what happened in one sentence and offers the one thing that might
 * actually help a human caught by it, and nothing else: no explanation of which
 * rule fired, no retry timer, no invitation to try again immediately. Naming
 * the rule would be a free hint to whoever is probing, and this app's own
 * failure vocabulary already refuses to leak Arcjet's reasons to a browser.
 *
 * It borrows `NotFoundNotice`'s shape rather than inventing a second unhappy
 * path, for the same reason that one borrows the empty arena's.
 */
export const RefusedNotice = () => (
  <PageColumn>
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-title text-ink">Not right now</h1>
      <p className="max-w-md text-body text-ink-muted">
        This request was turned away before it read anything. If you&rsquo;re a person and this
        keeps happening, give it a minute and try again.
      </p>
      <Link
        href="/"
        className="rounded-md text-body font-medium text-rust underline decoration-from-font underline-offset-4 hover:text-rust-hover"
      >
        Go to the arena
      </Link>
    </div>
  </PageColumn>
);
