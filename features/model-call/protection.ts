import "server-only";

import type { ArcjetDecision } from "@arcjet/next";

import { failure } from "./failures";
import type { ModelCallFailure } from "./types";

/**
 * Translates an Arcjet decision into this app's own vocabulary.
 *
 * Arcjet's reasons never reach the browser directly. They become one of our
 * failure kinds, which already carry a plain sentence and a retry flag, so a
 * blocked request reads the same way as any other problem: a human line and a
 * sensible next step.
 */

export type ProtectionOutcome =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly status: number; readonly failure: ModelCallFailure };

const ALLOWED: ProtectionOutcome = { allowed: true };

export const toProtectionOutcome = (decision: ArcjetDecision): ProtectionOutcome => {
  if (!decision.isDenied()) return ALLOWED;

  if (decision.reason.isRateLimit()) {
    return { allowed: false, status: 429, failure: failure("rate-limited") };
  }

  if (decision.reason.isPromptInjection()) {
    return { allowed: false, status: 400, failure: failure("flagged") };
  }

  // Bot, shield, filter, and anything added later all mean the same thing to a
  // person: refused before it got anywhere.
  return { allowed: false, status: 403, failure: failure("blocked") };
};

/** What goes in the server log. The detail stays here, not in the browser. */
export const describeDecisionForLog = (decision: ArcjetDecision): string =>
  `conclusion=${decision.conclusion} reason=${decision.reason.type} id=${decision.id}`;

/**
 * Which rules failed to evaluate, by rule type.
 *
 * A rule that errors fails open — the request proceeds as if the rule had
 * passed. That is the right call, since a bad moment at the security service
 * must not take the app down, but it means protection can quietly stop
 * happening while everything still looks fine. Naming the rules that did not
 * run is what turns assumed coverage into measured coverage.
 */
export const unevaluatedRules = (decision: ArcjetDecision): readonly string[] =>
  decision.results
    .filter((result) => result.conclusion === "ERROR")
    .map((result) => result.reason.type ?? "UNKNOWN");

/**
 * True when the request was never actually screened for prompt injection, so
 * an untrusted prompt reached the model unchecked.
 *
 * Established by absence rather than by reading the error, deliberately. A rule
 * that runs leaves a result carrying its own type, whatever it concluded; a rule
 * that fails leaves a result typed only `ERROR`, with no trace of which rule it
 * was. So the sound question is not "did the injection rule error" — that is
 * unanswerable from the payload — but "is there any evidence it ran at all".
 */
export const promptInjectionWentUnchecked = (decision: ArcjetDecision): boolean =>
  !decision.results.some((result) => result.reason.type === "PROMPT_INJECTION_DETECTION");
