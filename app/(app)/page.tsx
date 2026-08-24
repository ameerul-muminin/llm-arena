import type { Metadata } from "next";

import { NewThread } from "@/features/arena/new-thread";
import { getFreeModels } from "@/features/catalogue/catalogue";

/**
 * The arena, before there is anything in it.
 *
 * The page scrolls; the top bar sticks to the top of it and the composer to the
 * bottom. Nesting a scroll container inside the layout would have worked too and
 * is worse — it needs a `min-h-0` on every ancestor to behave, and it breaks the
 * browser's own find-on-page scrolling.
 *
 * The catalogue is read here and handed down. It is a fact about the page, known
 * before it renders, so making the browser ask for it separately would add a
 * fetch, a loading state, and an API route for nothing.
 */

export const metadata: Metadata = {
  title: "Arena — LLM Arena",
};

/*
 * Rendered per request so the catalogue's retry is real — the reason is measured
 * and written down in `features/catalogue/catalogue.ts`. The fetch itself is
 * still cached for an hour and shared by every visitor.
 */
export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const catalogue = await getFreeModels();

  return <NewThread catalogue={catalogue} />;
}
