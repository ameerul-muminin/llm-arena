import "server-only";

import { encodeEvent, NDJSON_CONTENT_TYPE } from "./wire";
import type { ModelCallEvent } from "./types";

/**
 * Turns a stream of events into an HTTP response. This is the only place the
 * feature touches HTTP at all.
 */
export const toEventStreamResponse = (
  events: AsyncIterable<ModelCallEvent>,
  status = 200,
): Response => {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    status,
    headers: {
      "content-type": NDJSON_CONTENT_TYPE,
      // Proxies must not sit on this; a buffered stream is not a stream.
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
};

/**
 * A refusal, sent in exactly the same shape as a successful stream.
 *
 * The HTTP status still tells the truth for logs and proxies, but the body is
 * one `error` event, so the browser reads a denial through the same code path
 * as everything else and the human sentence survives intact.
 */
export const toRefusalResponse = (event: ModelCallEvent, status: number): Response =>
  toEventStreamResponse(
    (async function* () {
      yield event;
    })(),
    status,
  );
