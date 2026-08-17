import { APICallError, RetryError } from "ai";

import type { ModelCallFailure, ModelCallFailureKind } from "./types";

/**
 * Every provider error funnels through here and comes out as a plain sentence.
 * Nothing a provider wrote is ever shown to a person.
 */

const SENTENCES: Readonly<Record<ModelCallFailureKind, string>> = {
  unauthorized: "This app isn't set up to reach that model right now.",
  "rate-limited": "That model is busy at the moment. Give it a few seconds.",
  unavailable: "That model didn't respond. It might be having a rough moment.",
  timeout: "That model took too long to answer.",
  aborted: "That answer was stopped.",
  "sign-in-required": "Sign in to send a prompt.",
  blocked: "That request was blocked before it reached the model.",
  flagged: "That prompt looks like an attempt to manipulate the model, so it wasn't sent.",
  unknown: "Something went wrong reaching that model.",
};

const RETRYABLE: Readonly<Record<ModelCallFailureKind, boolean>> = {
  unauthorized: false,
  "rate-limited": true,
  unavailable: true,
  timeout: true,
  aborted: true,
  // Retrying changes nothing; signing in does. The UI offers that instead.
  "sign-in-required": false,
  // Retrying an identical blocked or flagged request just gets blocked again.
  blocked: false,
  flagged: false,
  unknown: true,
};

export const failure = (kind: ModelCallFailureKind): ModelCallFailure => ({
  kind,
  message: SENTENCES[kind],
  retryable: RETRYABLE[kind],
});

const fromStatus = (status: number | undefined): ModelCallFailureKind => {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 402) return "unauthorized";
  // OpenRouter answers 404 both for a slug that does not exist and for one that
  // is no longer offered on the free tier. Either way the model is not there.
  if (status === 404) return "unavailable";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate-limited";
  if (status !== undefined && status >= 500) return "unavailable";
  return "unknown";
};

const isAbort = (error: unknown): boolean =>
  error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

/**
 * The SDK retries before giving up and hands back a `RetryError` wrapping the
 * real one. Without unwrapping, an upstream 429 reads as a generic "something
 * went wrong", which is exactly the sort of dishonest message this app is
 * supposed to avoid.
 */
const unwrap = (error: unknown): unknown =>
  RetryError.isInstance(error) ? (error.lastError ?? error.errors.at(-1) ?? error) : error;

export const toFailure = (error: unknown): ModelCallFailure => {
  const cause = unwrap(error);
  if (isAbort(cause)) return failure("aborted");
  if (APICallError.isInstance(cause)) return failure(fromStatus(cause.statusCode));
  return failure("unknown");
};

/**
 * What actually gets logged on the server. Keeps the real detail where it is
 * useful and out of the browser.
 */
export const describeForLog = (rawError: unknown): string => {
  const error = unwrap(rawError);
  if (APICallError.isInstance(error)) {
    return `${error.name} status=${error.statusCode ?? "none"} url=${error.url} message=${error.message}`;
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return `Non-error thrown: ${String(error)}`;
};
