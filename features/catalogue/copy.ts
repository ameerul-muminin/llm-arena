/**
 * The two sentences a screen prints when there is no list to show.
 *
 * Here rather than in `catalogue.ts` because that module is `server-only` and
 * the picker is a client component. Here rather than at the call sites because
 * both the arena and `/models` print them, and the same condition has to read
 * the same way in both places.
 *
 * Neither sentence apologises or mentions OpenRouter's status code. `CLAUDE.md`
 * allows a plain human sentence and a retry, and that is all these are.
 */

export const CATALOGUE_UNAVAILABLE =
  "The model list didn't load, so there's nothing to choose from yet.";

export const CATALOGUE_EMPTY = "There are no free models on OpenRouter right now.";
