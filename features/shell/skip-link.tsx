/**
 * The first thing a keyboard reaches, and invisible until it does.
 *
 * A persistent sidebar puts a nav, a "new thread" control, and every past thread
 * between the top of the page and the answers. Without this, reaching the thing
 * you came for means tabbing past all of it on every single page.
 *
 * It names the destination rather than saying "skip to content", because on this
 * app the content has an actual name.
 */
export const SkipLink = () => (
  <a
    href="#main"
    className="sr-only rounded-md bg-rust px-3 py-2 text-detail font-medium text-rust-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
  >
    Skip to the answers
  </a>
);
