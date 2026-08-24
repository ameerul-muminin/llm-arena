import type { AnswerState } from "@/features/design/answer-card";
import { axisScaleFor, type AxisSpan } from "@/features/design/time-axis";
import { failure } from "@/features/model-call/failures";
import type { ModelCallFailure, ModelMetrics } from "@/features/model-call/types";

/**
 * One fake turn, shared by the arena screen and the design reference.
 *
 * **This is placeholder data and the screens that use it say so.** Real streaming
 * is feature 6; until it lands this is how the answer grid, the shared time axis,
 * and the three states that are awkward to catch by hand get looked at
 * deliberately — a model that streams, a model that thinks for a while and then
 * flushes everything at once, and a model that fails partway.
 *
 * It lives here rather than beside either screen because both need the identical
 * turn. Two copies of the same fake data is a second place for them to drift,
 * which is the same reasoning that keeps the timing maths in `metrics.ts` alone.
 *
 * The numbers are internally consistent rather than invented freely. Generation
 * speed is written text over the streaming window; overall speed is everything
 * produced, thinking included, over the whole wait. Letting those disagree would
 * teach the wrong thing on the very page built to explain them.
 *
 * The failure sentence comes from `failures.ts` rather than being retyped, so
 * this cannot drift from what a person would really be shown.
 */

export type Fixture = {
  readonly modelId: string;
  readonly modelName: string;
  readonly text: string;
  readonly timeToFirstTokenMs: number;
  /** `null` for a model that flushes its whole answer at once. */
  readonly generationMs: number | null;
  readonly totalMs: number;
  readonly streamed: boolean;
  readonly failsAtMs: number | null;
  readonly failure: ModelCallFailure | null;
  readonly metrics: ModelMetrics | null;
};

export const FIXTURE_PROMPT = "What is a pull request, in two sentences?";

export const FIXTURES: readonly Fixture[] = [
  {
    modelId: "google/gemma-4-31b-it:free",
    modelName: "Gemma 4 31B",
    text: "A pull request is a request to merge one branch into another, with a place for people to review the change before it lands. It is a GitHub feature, not a Git one.",
    timeToFirstTokenMs: 412,
    generationMs: 1350,
    totalMs: 1780,
    streamed: true,
    failsAtMs: null,
    failure: null,
    metrics: {
      timeToFirstTokenMs: 412,
      generationMs: 1350,
      totalMs: 1780,
      deltaCount: 48,
      streamed: true,
      tokensPerSecond: 178,
      endToEndTokensPerSecond: 142,
      inputTokens: 34,
      outputTokens: 252,
      reasoningTokens: 12,
      textTokens: 240,
      totalTokens: 286,
    },
  },
  {
    modelId: "qwen/qwen3-14b:free",
    modelName: "Qwen3 14B",
    text: "It is a request to merge a branch. Reviewers comment on it, and it lands once approved.",
    timeToFirstTokenMs: 2400,
    generationMs: null,
    totalMs: 2460,
    streamed: false,
    failsAtMs: null,
    failure: null,
    metrics: {
      timeToFirstTokenMs: 2400,
      generationMs: null,
      totalMs: 2460,
      deltaCount: 1,
      streamed: false,
      // No window to divide by, so no generation speed. This is the honest null.
      tokensPerSecond: null,
      endToEndTokensPerSecond: 195,
      inputTokens: 34,
      outputTokens: 480,
      // 436 of 480 tokens were spent thinking; only 44 were ever written.
      reasoningTokens: 436,
      textTokens: 44,
      totalTokens: 514,
    },
  },
  {
    modelId: "meta-llama/llama-3.3-8b-instruct:free",
    modelName: "Llama 3.3 8B",
    text: "",
    timeToFirstTokenMs: Number.POSITIVE_INFINITY,
    generationMs: null,
    totalMs: 1840,
    streamed: false,
    failsAtMs: 1840,
    failure: failure("rate-limited"),
    metrics: null,
  },
];

/** A little past the slowest finisher, so the turn visibly settles. */
export const FIXTURE_END_MS = Math.max(...FIXTURES.map((fixture) => fixture.totalMs)) + 600;

const finalSpan = (fixture: Fixture): AxisSpan => ({
  timeToFirstTokenMs: fixture.failsAtMs === null ? fixture.timeToFirstTokenMs : null,
  generationMs: fixture.generationMs,
  elapsedMs: fixture.totalMs,
  streamed: fixture.streamed,
  outcome: fixture.failsAtMs === null ? "finished" : "failed",
});

/**
 * The shared denominator every card in this turn is drawn against. Computed once
 * from the whole turn, not per card — that is the entire idea of the axis.
 */
export const FIXTURE_SCALE_MS = axisScaleFor(FIXTURES.map(finalSpan));

/** Only reachable if a fixture is misconfigured; never rendered as-is in practice. */
const MISSING_METRICS: ModelMetrics = {
  timeToFirstTokenMs: null,
  generationMs: null,
  totalMs: 0,
  deltaCount: 0,
  streamed: false,
  tokensPerSecond: null,
  endToEndTokensPerSecond: null,
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  textTokens: null,
  totalTokens: null,
};

/** Where a given fixture had got to at `nowMs`. Pure. */
export const deriveAt = (
  fixture: Fixture,
  nowMs: number,
): { readonly state: AnswerState; readonly span: AxisSpan } => {
  if (fixture.failure !== null && fixture.failsAtMs !== null && nowMs >= fixture.failsAtMs) {
    return { state: { status: "failed", failure: fixture.failure }, span: finalSpan(fixture) };
  }

  if (nowMs < fixture.timeToFirstTokenMs) {
    return {
      state: { status: "waiting" },
      span: {
        timeToFirstTokenMs: null,
        generationMs: null,
        elapsedMs: nowMs,
        streamed: fixture.streamed,
        outcome: "running",
      },
    };
  }

  const generationEnd = fixture.timeToFirstTokenMs + (fixture.generationMs ?? 0);

  if (nowMs >= generationEnd) {
    return {
      state: { status: "done", text: fixture.text, metrics: fixture.metrics ?? MISSING_METRICS },
      span: finalSpan(fixture),
    };
  }

  const progress = (nowMs - fixture.timeToFirstTokenMs) / (fixture.generationMs ?? 1);
  return {
    state: {
      status: "streaming",
      text: fixture.text.slice(0, Math.max(1, Math.round(fixture.text.length * progress))),
    },
    span: {
      timeToFirstTokenMs: fixture.timeToFirstTokenMs,
      generationMs: null,
      elapsedMs: nowMs,
      streamed: fixture.streamed,
      outcome: "running",
    },
  };
};
