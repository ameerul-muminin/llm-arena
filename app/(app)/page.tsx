import type { Metadata } from "next";

import { Composer } from "@/features/arena/composer";
import { FixtureTurn } from "@/features/arena/fixture-turn";
import { FIXTURE_PROMPT } from "@/features/arena/fixtures";
import { PlaceholderNote } from "@/features/shell/placeholder-note";

/**
 * The arena.
 *
 * The page scrolls; the top bar sticks to the top of it and the composer to the
 * bottom. Nesting a scroll container inside the layout would have worked too and
 * is worse — it needs a `min-h-0` on every ancestor to behave, and it breaks the
 * browser's own find-on-page scrolling.
 */

export const metadata: Metadata = {
  title: "Arena — LLM Arena",
};

export default function ArenaPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 sm:px-4">
      <div className="flex-1 space-y-6 py-6">
        <PlaceholderNote>
          These three answers are fixture data on a loop, not live calls. The cards, the metrics,
          and the shared time axis under them are the real components — only the tokens are fake.
        </PlaceholderNote>

        <FixtureTurn prompt={FIXTURE_PROMPT} />
      </div>

      <div className="sticky bottom-0 bg-ground/85 pt-2 pb-4 backdrop-blur-sm">
        <Composer />
      </div>
    </div>
  );
}
