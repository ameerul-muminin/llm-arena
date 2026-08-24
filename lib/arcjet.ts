import "server-only";

import arcjet, {
  createRemoteClient,
  detectBot,
  detectPromptInjection,
  shield,
  tokenBucket,
} from "@arcjet/next";

/**
 * Arcjet sits in front of both write paths — submitting a prompt, and each
 * model call it turns into — before OpenRouter is ever touched, so anything
 * denied here costs us nothing downstream.
 *
 * **Two clients over one base, because the two paths are not the same request.**
 * Shield and bot detection apply to both: both are endpoints a script can find.
 * The other two rules each belong to exactly one:
 *
 * - **Prompt-injection detection belongs to submitting a prompt.** One prompt
 *   becomes three model calls, so screening at the call site screened the same
 *   text three times: three times a metered add-on's token cost for one
 *   question, and three independent chances to reach different conclusions
 *   about it. Screening once, where the prompt is actually submitted, also
 *   means a flagged prompt never creates a turn at all rather than creating one
 *   and then refusing it three times.
 * - **The token bucket belongs to the model call**, because that is where the
 *   real cost is. Spending the whole turn's budget up front would leave a known
 *   `turnId` re-postable for free.
 *
 * The bucket is the part worth understanding. Our transport is one HTTP request
 * per model, so a prompt sent to three models is three requests. A plain
 * per-request limit would quietly punish people for using the arena as intended
 * — three models would burn budget three times faster than one, for the same
 * single prompt. A token bucket spending one token per model call is the honest
 * version of that: the budget tracks real model usage, and a three-model prompt
 * genuinely does cost three times a one-model prompt, because it is.
 *
 * Capacity 30 with a 10-per-minute refill means roughly ten three-model prompts
 * up front, then a steady three or so per minute. Comfortable for a person
 * actually using it, quick to stop a script.
 *
 * Keyed by the signed-in Clerk user, not by IP. Sending a prompt requires an
 * account, so there is always a trusted id to key on, and the budget follows
 * the person rather than the network they happen to be on — an office or a
 * cafe behind one NAT no longer shares a single allowance. The id comes from
 * `auth()` on the server and is never read from a client-supplied header.
 */
const base = arcjet({
  // The one sanctioned direct read of a secret, and the reason it exists: this
  // runs at module scope, and `next build` evaluates route modules, so reaching
  // for a validated key here would make building the app require a live secret.
  // A build is not a run. Safety comes from elsewhere — `ARCJET_KEY` is in the
  // startup check, so the server cannot come up without it, and the `?? ""` is
  // only satisfying the type at a point where the value is already guaranteed.
  // eslint-disable-next-line no-restricted-syntax
  key: process.env.ARCJET_KEY ?? "",
  // The SDK's default decision deadline is 500ms in production and 1s in
  // development. Shield and bot detection answer well inside that, but prompt
  // injection analysis does not: at the default it timed out every single time,
  // and a timeout fails open, meaning the rule silently never ran. A security
  // rule that quietly does nothing is worse than not having it. Five seconds is
  // long enough for the analysis to actually return, and it is spent before a
  // model call that already takes far longer than that.
  client: createRemoteClient({ timeout: 5_000 }),
  rules: [shield({ mode: "LIVE" }), detectBot({ mode: "LIVE", allow: [] })],
});

/** Submitting a prompt: screened once, here, before a turn exists. */
export const ajStartTurn = base.withRule(detectPromptInjection({ mode: "LIVE" }));

/** One model call, spending one token of this person's budget. */
export const ajModelCall = base.withRule(
  tokenBucket({
    mode: "LIVE",
    characteristics: ["userId"],
    capacity: 30,
    refillRate: 10,
    interval: "1m",
  }),
);

/** One model call spends one token. */
export const TOKENS_PER_MODEL_CALL = 1;
