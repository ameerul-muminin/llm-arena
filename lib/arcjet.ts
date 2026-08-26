import "server-only";

import arcjet, {
  createRemoteClient,
  detectBot,
  detectPromptInjection,
  shield,
  slidingWindow,
  tokenBucket,
} from "@arcjet/next";

/**
 * Arcjet sits in front of both write paths — submitting a prompt, and each
 * model call it turns into — before OpenRouter is ever touched, so anything
 * denied here costs us nothing downstream.
 *
 * **Two bases, split by decision deadline, and five clients derived from them.**
 * Feature 10 added the second base and the reason is written next to it: the
 * five-second deadline the write paths need is affordable before a model call
 * and unaffordable on a page render.
 *
 * On the slow base, shield and bot detection apply to both write paths — both
 * are endpoints a script can find. The other two rules each belong to exactly
 * one:
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
 *
 * The fast base carries the three clients feature 10 added — the two public
 * reads and the vote — and each is documented where it is declared.
 */

/**
 * The one sanctioned direct read of a secret, and the reason it exists: this
 * runs at module scope, and `next build` evaluates route modules, so reaching
 * for a validated key here would make building the app require a live secret.
 * A build is not a run. Safety comes from elsewhere — `ARCJET_KEY` is in the
 * startup check, so the server cannot come up without it, and the `?? ""` is
 * only satisfying the type at a point where the value is already guaranteed.
 */
// eslint-disable-next-line no-restricted-syntax
const KEY = process.env.ARCJET_KEY ?? "";

const slowBase = arcjet({
  key: KEY,
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

/**
 * Everything that is not screening a prompt, on a deadline a person can wait
 * for. Feature 10's reason for a second client rather than another `withRule`:
 * the five seconds above exists solely so prompt-injection analysis can return,
 * and it is affordable there because it is spent before a model call that takes
 * far longer anyway. On a page render it would mean a bad moment at Arcjet
 * stalling every public page for five seconds — a worse availability story than
 * the abuse being defended against. One second is comfortably more than the
 * default these rules were already measured against.
 */
const fastBase = arcjet({
  key: KEY,
  client: createRemoteClient({ timeout: 1_000 }),
  rules: [shield({ mode: "LIVE" })],
});

/** Submitting a prompt: screened once, here, before a turn exists. */
export const ajStartTurn = slowBase.withRule(detectPromptInjection({ mode: "LIVE" }));

/** One model call, spending one token of this person's budget. */
export const ajModelCall = slowBase.withRule(
  tokenBucket({
    mode: "LIVE",
    characteristics: ["userId"],
    capacity: 30,
    refillRate: 10,
    interval: "1m",
  }),
);

/**
 * The public reads, added by feature 10.
 *
 * Two of them, because the bot allow-list is not the same on both and feature 8
 * is what decides it rather than a preference:
 *
 * - A thread is `noindex` and rich link previews are deliberately parked, so no
 *   bot has business there and the list is empty.
 * - The leaderboard is a product page that stays indexable and should unfurl
 *   when someone shares it, so verified search engines and preview fetchers are
 *   let through. Anything else is not a reader.
 *
 * Both carry a sliding window rather than a token bucket. The bucket is right
 * for a model call, where one prompt genuinely costs one to three of them, so
 * the requested amount carries real information. A page view always costs
 * exactly one page view, and a sliding window has no boundary burst to exploit.
 *
 * **Keyed by IP, which is what pulling Clerk forward moved away from**, and the
 * choice is being made again rather than forgotten. An anonymous reader has no
 * trusted id, so IP is the only key that exists. It is acceptable here and not
 * on a write path because the consequence differs: a shared allowance on a
 * write costs someone the use of the app, while here it costs a shared link a
 * slow page — and the limits are set high enough that a real reader, and an
 * owner whose screen refreshes once per turn, per retry, and per vote, never
 * approaches them.
 */
const publicRead = (max: number) => slidingWindow({ mode: "LIVE", interval: "1m", max });

export const ajThreadRead = fastBase
  .withRule(detectBot({ mode: "LIVE", allow: [] }))
  .withRule(publicRead(60));

export const ajBoardRead = fastBase
  .withRule(detectBot({ mode: "LIVE", allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"] }))
  .withRule(publicRead(30));

/**
 * Picking a winner, which had no protection at all until feature 10 went
 * looking. A vote is one row per turn and cannot be recast, so a person's
 * natural ceiling is already low; twenty a minute is aimed at a script. Keyed by
 * the Clerk user, since voting requires an account and there is a trusted id.
 */
export const ajVote = fastBase.withRule(detectBot({ mode: "LIVE", allow: [] })).withRule(
  slidingWindow({
    mode: "LIVE",
    characteristics: ["userId"],
    interval: "1m",
    max: 20,
  }),
);

/** One model call spends one token. */
export const TOKENS_PER_MODEL_CALL = 1;
