import "server-only";

/**
 * The one way a public page asks whether it should do any work.
 *
 * Extracted rather than written twice, because both callers have to do the same
 * four things in the same order — take a decision, log the detail on the server
 * only, record the coverage gap if a rule failed to evaluate, and throw the
 * interrupt — and two copies of a security check are two chances for one of
 * them to drift.
 *
 * **This runs before the database is touched, which is the entire point.** The
 * abuse feature 10 defends against is a cheap request turning into an expensive
 * read, so the guard sits above the read rather than beside it. A caller that
 * awaits its query first and guards second has protected nothing.
 *
 * **Deduped per request with `cache()`, for the same reason `findThread` is and
 * then one more.** A thread page reads the database from `generateMetadata`,
 * from the page, and from the top bar's parallel slot, so all three have to
 * guard or the first one through does the expensive read unprotected. Guarding
 * three times would be three decisions for one request and, worse, three
 * tokens off a rate limit that is supposed to count page views. `cache()` makes
 * "every entry point guards" and "one decision per request" the same thing.
 *
 * `forbidden()` throws, so an allowed read returns `void` and a denied one never
 * returns. There is no result to branch on, so a caller cannot forget to.
 */

import { request as arcjetRequest } from "@arcjet/next";
import type { ArcjetNext } from "@arcjet/next";
import { forbidden } from "next/navigation";
import { cache } from "react";

import { describeDecisionForLog, unevaluatedRules } from "@/features/model-call/protection";
import { ajBoardRead, ajThreadRead } from "@/lib/arcjet";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * The shape of a client whose rules need no extra props, which is every read
 * client here — the sliding windows key on the caller's IP, which Arcjet
 * resolves itself. A client wanting `userId` would not fit, and that is
 * deliberate: this helper is for the anonymous reads.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type ReadClient = ArcjetNext<{}>;

const guardRead = async (client: ReadClient, route: string): Promise<void> => {
  const decision = await client.protect(await arcjetRequest());

  /*
   * A rule that errors fails open, which is the right call — a bad moment at
   * the security service must not take the app down — but it means protection
   * can quietly stop happening while everything still looks fine. Recorded the
   * way the model-call path already records it, so "what fraction of reads were
   * actually screened?" has a real answer for these routes too.
   *
   * **`isErrored()` is checked as well as the per-rule results, because the
   * per-rule list alone misses the worst case.** Observed live rather than
   * reasoned about: running locally with no client IP, the sliding window could
   * not build a fingerprint, the whole decision errored, `results` came back
   * empty, and a check that only mapped over `results` reported full coverage
   * for a request nothing had screened. An errored decision means no rule ran,
   * which is the one outcome this most needs to notice.
   */
  const unevaluated = decision.isErrored()
    ? ["ALL_RULES", ...unevaluatedRules(decision)]
    : unevaluatedRules(decision);

  if (unevaluated.length > 0) {
    console.warn(`[arcjet] failed open on ${route}: ${unevaluated.join(", ")}`);
    getPostHogClient()?.capture({
      distinctId: `route:${route}`,
      event: "arcjet_failed_open",
      properties: { route, unevaluated_rules: unevaluated },
    });
    await getPostHogClient()?.flush();
  }

  if (!decision.isDenied()) return;

  console.warn(`[arcjet] denied ${route} ${describeDecisionForLog(decision)}`);
  forbidden();
};

/** One thread, read by anyone with the link. No bot has business here. */
export const guardThreadRead = cache(() => guardRead(ajThreadRead, "thread"));

/** The leaderboard, which stays indexable and so lets verified crawlers past. */
export const guardBoardRead = cache(() => guardRead(ajBoardRead, "leaderboard"));
