import "server-only";

import { PostHog } from "posthog-node";

import type { ModelMetrics } from "@/features/model-call/types";

/** Stated once, for the analytics record of where these calls actually went. */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let posthogClient: PostHog | null = null;

/**
 * Returns a singleton PostHog server client, or null when the token is not
 * configured (so callers can guard cheaply without crashing the server).
 */
export function getPostHogClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " +
          "this causes events to be silently missed. " +
          "This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }

  posthogClient ??= new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // Route calls go through once per request — flush immediately so events
    // are not dropped when the serverless function tears down.
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogClient;
}

/**
 * PostHog's own LLM analytics, which is a different thing from the funnel
 * events around it: this is the per-call record of what a model cost in time
 * and tokens.
 *
 * **The numbers come from `ModelMetrics`, not from a second measurement.** The
 * SDK ships a wrapper that instruments the provider call and reports its own
 * latency and token figures. This app already measures those, deliberately and
 * with rules about when it refuses to report one at all — a generation speed is
 * `null` for a model that flushed in one go, reasoning tokens are split from
 * written ones. Letting a wrapper report its own version would put a second
 * source behind a number that already has one, which is the exact drift the
 * metrics contract exists to prevent.
 *
 * **No prompt text and no answer text is sent.** `$ai_input` and
 * `$ai_output_choices` are supported and are deliberately left empty: shipping
 * every prompt a person writes and every answer they get to an analytics vendor
 * is a much larger decision than "turn on LLM analytics", and nothing this app
 * shows needs it. The cost is real and accepted — the dashboard reports on
 * speed, tokens and volume, and cannot show what was asked.
 *
 * Latency is in seconds, which is PostHog's unit, converted here from the
 * milliseconds everything else in this app measures in.
 */
export function captureGeneration(input: {
  readonly distinctId: string;
  /** The turn, so all three models answering one prompt share a trace. */
  readonly traceId: string;
  readonly modelId: string;
  readonly metrics: ModelMetrics | null;
  readonly failed: boolean;
}): void {
  const posthog = getPostHogClient();
  if (posthog === null) return;

  const { metrics } = input;

  posthog.capture({
    distinctId: input.distinctId,
    event: "$ai_generation",
    properties: {
      $ai_trace_id: input.traceId,
      $ai_span_name: "arena model call",
      $ai_model: input.modelId,
      $ai_provider: "openrouter",
      $ai_base_url: OPENROUTER_BASE_URL,
      $ai_is_error: input.failed,
      $ai_input_tokens: metrics?.inputTokens ?? null,
      $ai_output_tokens: metrics?.outputTokens ?? null,
      $ai_latency: metrics === null ? null : metrics.totalMs / 1000,
      $ai_time_to_first_token:
        metrics?.timeToFirstTokenMs === undefined || metrics.timeToFirstTokenMs === null
          ? null
          : metrics.timeToFirstTokenMs / 1000,
      // Every model in this app is free tier. Zero is the real number, not a
      // placeholder, and it is the same one the cards print.
      $ai_total_cost_usd: 0,
    },
  });
}
