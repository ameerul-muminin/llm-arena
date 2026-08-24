import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn`, taught about this project's type scale.
 *
 * The stock `twMerge` silently drops our font sizes. It resolves conflicts by
 * class group, and it cannot tell `text-micro` (a size from feature 4's scale)
 * from `text-ink-muted` (a colour) — both look like `text-*`, so it keeps the
 * last one and throws the other away. `cn("text-micro text-ink-muted")` returned
 * `text-ink-muted`, and the size just vanished.
 *
 * That is exactly the kind of bug that never announces itself: nothing errors,
 * the element simply inherits the wrong size. It was caught by reading the
 * rendered HTML of the model marks in the top bar and noticing a class that
 * should have been there was not.
 *
 * Naming the five sizes fixes it without weakening anything — real conflicts
 * still collapse, so `text-detail text-body` is still `text-body`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "title", "body", "detail", "micro"] }],
    },
  },
});

export const cn = (...inputs: readonly ClassValue[]) => twMerge(clsx(inputs));
