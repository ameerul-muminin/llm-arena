import type { Metadata } from "next";

import { NotFoundNotice } from "@/features/shell/not-found-notice";

/**
 * A URL that matches no route at all.
 *
 * The same words as the in-app version, without the shell — there is no route
 * group to be inside, so the sidebar and top bar genuinely do not apply here,
 * and faking them would frame a page that is not a screen of the app. A
 * mistyped thread link is the common way to arrive, which is why it says the
 * same thing rather than something more general: a person who mangled
 * `/thread/…` should not get a different answer than one who mangled the id.
 */

export const metadata: Metadata = {
  title: "Not found — LLM Arena",
};

export default function RootNotFound() {
  return <NotFoundNotice />;
}
