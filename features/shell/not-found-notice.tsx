import Link from "next/link";

import { PageColumn } from "./page-column";

/**
 * What a link that points at nothing says.
 *
 * **A deleted thread and a thread that never existed are deliberately the same
 * page.** Telling them apart would confirm to anyone holding a stale link that
 * the id was once real, which is a fact about someone else's conversation.
 *
 * It borrows the empty arena's shape on purpose — centred, one heading, one
 * sentence, one thing to do. A visitor who mistyped an id should land somewhere
 * that still reads as this product, and inventing a second layout for the
 * unhappy path is how an app ends up with two voices.
 *
 * The way out is a link rather than a button because it navigates. Rust, as
 * every link in this app is, and the only accent on the page.
 */
export const NotFoundNotice = () => (
  <PageColumn>
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-title text-ink">No thread here</h1>
      <p className="max-w-md text-body text-ink-muted">
        This link doesn&rsquo;t point at a thread. It may have been deleted, or the address may be
        off by a character.
      </p>
      <Link
        href="/"
        className="rounded-md text-body font-medium text-rust underline decoration-from-font underline-offset-4 hover:text-rust-hover"
      >
        Start a new thread
      </Link>
    </div>
  </PageColumn>
);
