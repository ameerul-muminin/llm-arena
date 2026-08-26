/**
 * Which board is being looked at, and how a URL says so.
 *
 * The scope lives in the address rather than in client state, so a personal
 * board is a place you can link to rather than a thing you have to click into.
 * It also means the right board is server-rendered on the first paint, instead
 * of a global board flickering into a personal one after hydration.
 *
 * Parsing is deliberately total and deliberately unforgiving in one direction:
 * anything that is not exactly `personal`, and anything at all from a signed-out
 * visitor, is the global board. A junk parameter is not an error worth a screen,
 * and the signed-in check here is convenience rather than protection — the query
 * is what actually scopes the data, and it is given an owner id or nothing.
 */

export type BoardScope = "global" | "personal";

/**
 * `searchParams` hands over `string | string[] | undefined`, because a URL can
 * carry the same key twice. Only the exact single value counts.
 */
export const parseScope = (
  raw: string | readonly string[] | undefined,
  signedIn: boolean,
): BoardScope => (signedIn && raw === "personal" ? "personal" : "global");

export const SCOPE_HREF: Record<BoardScope, string> = {
  global: "/leaderboard",
  personal: "/leaderboard?scope=personal",
};
