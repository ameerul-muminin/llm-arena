import type { Metadata } from "next";

import { NotFoundNotice } from "@/features/shell/not-found-notice";

/**
 * A thread that isn't there, still inside the app.
 *
 * It lives in the route group rather than at the root so it inherits the shell:
 * sidebar, top bar, and a way back. `notFound()` from `/thread/[id]` finds this
 * boundary first, which is the whole reason it is here and not one level up.
 */

export const metadata: Metadata = {
  title: "Not found — LLM Arena",
};

export default function AppNotFound() {
  return <NotFoundNotice />;
}
