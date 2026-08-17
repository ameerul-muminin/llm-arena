import type {
  ModelCallEvent,
  ModelCallFailure,
  ModelCallFailureKind,
  ModelMetrics,
} from "./types";

/**
 * The wire format between the streaming route and the browser: newline
 * delimited JSON, one `ModelCallEvent` per line.
 *
 * Plain enough to read with `curl` and to parse in a few lines on the client,
 * and it carries our own event shape rather than a framework's, which is what
 * keeps the metrics contract ours end to end.
 */

export const NDJSON_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export const encodeEvent = (event: ModelCallEvent): string => `${JSON.stringify(event)}\n`;

/**
 * Splits a chunk into whole lines, returning the trailing partial line so the
 * caller can prepend it to the next chunk. Pure: no buffer is held in here.
 */
export const splitLines = (
  carry: string,
  chunk: string,
): { readonly lines: readonly string[]; readonly carry: string } => {
  const parts = `${carry}${chunk}`.split("\n");
  return {
    lines: parts.slice(0, -1).filter((line) => line.trim() !== ""),
    carry: parts.at(-1) ?? "",
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const numberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const FAILURE_KINDS: readonly ModelCallFailureKind[] = [
  "unauthorized",
  "rate-limited",
  "unavailable",
  "timeout",
  "aborted",
  "sign-in-required",
  "blocked",
  "flagged",
  "unknown",
];

const isFailureKind = (value: unknown): value is ModelCallFailureKind =>
  typeof value === "string" && FAILURE_KINDS.some((kind) => kind === value);

const toMetrics = (value: unknown): ModelMetrics | null => {
  if (!isRecord(value)) return null;
  const totalMs = numberOrNull(value.totalMs);
  if (totalMs === null) return null;

  return {
    timeToFirstTokenMs: numberOrNull(value.timeToFirstTokenMs),
    generationMs: numberOrNull(value.generationMs),
    totalMs,
    deltaCount: numberOrNull(value.deltaCount) ?? 0,
    streamed: value.streamed === true,
    tokensPerSecond: numberOrNull(value.tokensPerSecond),
    endToEndTokensPerSecond: numberOrNull(value.endToEndTokensPerSecond),
    inputTokens: numberOrNull(value.inputTokens),
    outputTokens: numberOrNull(value.outputTokens),
    reasoningTokens: numberOrNull(value.reasoningTokens),
    textTokens: numberOrNull(value.textTokens),
    totalTokens: numberOrNull(value.totalTokens),
  };
};

const toFailurePayload = (value: unknown): ModelCallFailure | null => {
  if (!isRecord(value)) return null;
  if (!isFailureKind(value.kind)) return null;
  if (typeof value.message !== "string" || value.message === "") return null;
  if (typeof value.retryable !== "boolean") return null;

  return { kind: value.kind, message: value.message, retryable: value.retryable };
};

/**
 * Anything not recognisably one of our events is dropped rather than trusted. A
 * malformed line must never become something a person sees.
 */
export const decodeEvent = (line: string): ModelCallEvent | null => {
  const parsed: unknown = ((): unknown => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })();

  if (!isRecord(parsed)) return null;

  switch (parsed.type) {
    case "start":
      return typeof parsed.modelId === "string" ? { type: "start", modelId: parsed.modelId } : null;

    case "delta":
      return typeof parsed.text === "string" ? { type: "delta", text: parsed.text } : null;

    case "done": {
      const metrics = toMetrics(parsed.metrics);
      return metrics === null ? null : { type: "done", metrics };
    }

    case "error": {
      const failure = toFailurePayload(parsed.failure);
      return failure === null ? null : { type: "error", failure };
    }

    default:
      return null;
  }
};
