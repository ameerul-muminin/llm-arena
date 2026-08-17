/**
 * The contract between a model call and everything downstream of it. The
 * server produces these events, the wire carries them verbatim, and the UI only
 * ever renders what is already in here. Nothing downstream re-derives a number
 * or re-interprets an error.
 */

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  readonly role: ChatRole;
  readonly content: string;
};

export type ModelCallRequest = {
  readonly modelId: string;
  readonly messages: readonly ChatMessage[];
};

/**
 * Measured, not estimated.
 *
 * - `timeToFirstTokenMs` — dispatch until the first text delta lands.
 * - `generationMs` — first text delta until the last one.
 * - `totalMs` — dispatch until the stream closes.
 * - `deltaCount` — how many separate text chunks actually arrived.
 * - `streamed` — whether the answer genuinely arrived over time, rather than
 *   being thought about and then flushed in one go.
 * - `tokensPerSecond` — generation speed, output tokens over `generationMs`.
 *   Only meaningful when `streamed` is true, and `null` otherwise: a model that
 *   delivers everything in one chunk has no observable generation speed, and
 *   dividing by that near-zero window produces a spectacular lie. Reporting
 *   nothing is the honest answer.
 * - `endToEndTokensPerSecond` — output tokens over `totalMs`, so it includes
 *   the wait for the first token. Defined for streaming and buffering models
 *   alike, which makes it the only speed number that compares fairly across
 *   models, and therefore the one the leaderboard should rank on.
 *
 * Output tokens are also split, because a short answer from a reasoning model
 * can report hundreds of tokens that were never written down, and one lump
 * figure makes it look absurdly verbose.
 *
 * Anything the provider did not report, or that cannot be computed honestly
 * (no tokens, no elapsed time), stays `null`. It is never zero-filled and never
 * guessed.
 */
export type ModelMetrics = {
  readonly timeToFirstTokenMs: number | null;
  readonly generationMs: number | null;
  readonly totalMs: number;
  readonly deltaCount: number;
  readonly streamed: boolean;
  readonly tokensPerSecond: number | null;
  readonly endToEndTokensPerSecond: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly textTokens: number | null;
  readonly totalTokens: number | null;
};

/**
 * A closed set of things that can go wrong. Provider text never reaches the
 * user; it is mapped into one of these, each carrying a plain human sentence.
 */
export type ModelCallFailureKind =
  | "unauthorized"
  | "rate-limited"
  | "unavailable"
  | "timeout"
  | "aborted"
  /** No signed-in user, and sending a prompt requires one. */
  | "sign-in-required"
  /** Refused before the model was called: bot detection, shield, IP filtering. */
  | "blocked"
  /** The prompt itself was refused, currently prompt-injection detection. */
  | "flagged"
  | "unknown";

export type ModelCallFailure = {
  readonly kind: ModelCallFailureKind;
  /** A plain sentence, safe to show as-is. */
  readonly message: string;
  /** Whether offering a retry actually makes sense. */
  readonly retryable: boolean;
};

export type ModelCallEvent =
  | { readonly type: "start"; readonly modelId: string }
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "done"; readonly metrics: ModelMetrics }
  | { readonly type: "error"; readonly failure: ModelCallFailure };
