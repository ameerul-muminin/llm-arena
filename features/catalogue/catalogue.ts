import "server-only";

import { parseCatalogue } from "./parse";
import type { Catalogue } from "./types";

/**
 * The live free-tier list, read on the server and nowhere else.
 *
 * Server-side for three reasons, in order of how much they matter: one cache is
 * shared by every visitor rather than one request per person, the third-party
 * URL never reaches a browser, and the picker and `/models` call the identical
 * function so they cannot disagree about what is free.
 *
 * **The endpoint needs no API key** — verified against the live service before
 * this was written, which is why `OPENROUTER_API_KEY` is not read here and does
 * not need to be. The key belongs to a model call, not to reading a price list.
 *
 * An hour of cache is the trade being made deliberately: free slugs rot, but
 * they rot over days, not minutes. Paying a round trip per visitor to notice a
 * change an hour sooner is not worth it.
 *
 * Failure never throws at the caller. It returns `ok: false`, the real reason
 * goes to the server log only, and the screen prints one plain sentence with a
 * retry — the same contract every other failure in this app follows.
 *
 * **Both callers set `dynamic = "force-dynamic"`, and that is this module's
 * requirement rather than their own preference.** Measured, not assumed: with
 * the pages left to prerender, `next build` rendered them once at build time and
 * every request for the next hour was served that HTML — so a build that
 * happened while OpenRouter was unreachable froze "the list didn't load" into
 * the page, and the retry button re-served the identical cached bytes. A retry
 * that cannot retry is worse than no retry, because it looks like one.
 *
 * Rendering per request costs nothing here, because the cache being relied on is
 * the fetch's, not the route's. Measured the same way: four renders across the
 * two routes made exactly one upstream call, and a run against a catalogue
 * answering 500 made four — a successful response is shared for the hour, a
 * failed one is never stored, so `Try again` genuinely tries again.
 */

const CATALOGUE_URL = "https://openrouter.ai/api/v1/models";

const REVALIDATE_SECONDS = 60 * 60;

export const getFreeModels = async (): Promise<Catalogue> => {
  try {
    const response = await fetch(CATALOGUE_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      console.error(`Model catalogue: OpenRouter answered ${response.status}.`);
      return { ok: false };
    }

    const payload: unknown = await response.json();
    return { ok: true, models: parseCatalogue(payload) };
  } catch (error) {
    console.error("Model catalogue: the request to OpenRouter failed.", error);
    return { ok: false };
  }
};
