import type { Metadata } from "next";

import { RefusedNotice } from "@/features/shell/refused-notice";

/**
 * Where a `forbidden()` thrown by a public read lands.
 *
 * In the route group rather than at the root, for the same reason the
 * not-found page is: the two protected reads live in here, so this is the
 * boundary they find first, and it inherits the shell.
 *
 * It behaves exactly like the `notFound()` finding feature 8 measured and wrote
 * up, because it is the same mechanism — `forbidden()` throws an error digest
 * of `NEXT_HTTP_ERROR_FALLBACK;403`, React discards the HTML pass for the
 * subtree, and the recovery tree ships as flight. So the status is a real 403
 * and the body is not server-rendered markup. For the audience actually being
 * refused, that is the right shape: correct status, almost no bytes.
 */

export const metadata: Metadata = {
  title: "Not right now — LLM Arena",
};

export default function AppForbidden() {
  return <RefusedNotice />;
}
