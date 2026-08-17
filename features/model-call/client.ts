import { failure } from "./failures";
import type { ModelCallEvent, ModelCallRequest } from "./types";
import { decodeEvent, splitLines } from "./wire";

/**
 * Browser side of one model call: post the prompt, read the NDJSON stream, hand
 * back typed events as they land.
 *
 * Each call owns its own request and its own signal, so aborting or losing one
 * model does nothing at all to the others.
 */

export const MODEL_CALL_ENDPOINT = "/api/model-call";

export type StreamModelCallOptions = {
  readonly signal?: AbortSignal;
  readonly endpoint?: string;
};

export async function* streamModelCall(
  request: ModelCallRequest,
  options: StreamModelCallOptions = {},
): AsyncGenerator<ModelCallEvent, void> {
  const endpoint = options.endpoint ?? MODEL_CALL_ENDPOINT;

  const response = await fetch(endpoint, {
    method: "POST",
    // No identity header. The server takes the user from `auth()`, which the
    // browser cannot influence; anything sent from here would be spoofable.
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: options.signal,
  }).catch(() => null);

  if (response === null) {
    yield { type: "error", failure: failure("unavailable") };
    return;
  }

  // A refusal still arrives as our own event stream, so a denied request keeps
  // its real sentence instead of collapsing into a generic message. Only when
  // the body is something else do we fall back to guessing from the status.
  const carriesEvents = (response.headers.get("content-type") ?? "").includes("x-ndjson");

  if (response.body === null || (!response.ok && !carriesEvents)) {
    yield { type: "error", failure: failure(response.status === 429 ? "rate-limited" : "unknown") };
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let carry = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const split = splitLines(carry, value);
      carry = split.carry;

      for (const line of split.lines) {
        const event = decodeEvent(line);
        if (event !== null) yield event;
      }
    }

    const tail = decodeEvent(carry.trim());
    if (tail !== null) yield tail;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    yield { type: "error", failure: failure(aborted ? "aborted" : "unavailable") };
  } finally {
    reader.releaseLock();
  }
}
