"use client";

// Clerk Core 3 replaced `<SignedIn>` / `<SignedOut>` with one `<Show when=…>`.
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";

import { streamModelCall } from "@/features/model-call/client";
import type { ModelCallFailure, ModelMetrics } from "@/features/model-call/types";

/**
 * A throwaway harness proving one real token stream reaches the browser with
 * honest numbers attached. Intentionally unstyled beyond legibility and the
 * accessibility baseline: the actual look is decided in the design feature and
 * this page gets deleted once the arena screen exists.
 */

type Status = "idle" | "streaming" | "done" | "failed";

// Free-tier slugs come and go; the model picker feature will pull the live list.
const DEFAULT_MODEL = "google/gemma-4-31b-it:free";

const ms = (value: number | null): string => (value === null ? "—" : `${Math.round(value)} ms`);
const rate = (value: number | null): string => (value === null ? "—" : `${value.toFixed(1)} tok/s`);
const count = (value: number | null): string => (value === null ? "—" : String(value));

export const StreamHarness = () => {
  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState("In one short paragraph, what is a language model?");
  const [answer, setAnswer] = useState("");
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [problem, setProblem] = useState<ModelCallFailure | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useUser();

  // Tie analytics to the Clerk user, so events belong to a real person rather
  // than an anonymous cookie that changes with every browser they use. The
  // server keys its own events on the same id.
  useEffect(() => {
    if (user?.id) posthog.identify(user.id);
  }, [user?.id]);

  const run = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnswer("");
    setMetrics(null);
    setProblem(null);
    setStatus("streaming");

    // Track when the user submits a prompt
    posthog.capture("model_call_started", {
      model_id: modelId,
      prompt_length: prompt.length,
    });

    // Client and server events already line up: both sides key on the Clerk
    // user id, so there is nothing to correlate by hand.
    const events = streamModelCall(
      { modelId, messages: [{ role: "user", content: prompt }] },
      { signal: controller.signal },
    );

    for await (const event of events) {
      if (event.type === "delta") setAnswer((current) => current + event.text);
      if (event.type === "done") {
        setMetrics(event.metrics);
        setStatus("done");
        // Track successful model call completion with timing and token metrics
        posthog.capture("model_call_completed", {
          model_id: modelId,
          time_to_first_token_ms: event.metrics.timeToFirstTokenMs,
          generation_ms: event.metrics.generationMs,
          total_ms: event.metrics.totalMs,
          tokens_per_second: event.metrics.tokensPerSecond,
          end_to_end_tokens_per_second: event.metrics.endToEndTokensPerSecond,
          streamed: event.metrics.streamed,
          delta_count: event.metrics.deltaCount,
          input_tokens: event.metrics.inputTokens,
          output_tokens: event.metrics.outputTokens,
          reasoning_tokens: event.metrics.reasoningTokens,
          text_tokens: event.metrics.textTokens,
          total_tokens: event.metrics.totalTokens,
        });
      }
      if (event.type === "error") {
        setProblem(event.failure);
        if (event.failure.kind === "aborted") {
          // Track when the user explicitly stops a running call
          posthog.capture("model_call_aborted", {
            model_id: modelId,
          });
          setStatus("idle");
        } else {
          // Track non-abort failures with the failure kind
          posthog.capture("model_call_failed", {
            model_id: modelId,
            failure_kind: event.failure.kind,
            retryable: event.failure.retryable,
          });
          setStatus("failed");
        }
      }
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Model stream check</h1>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded border border-current px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Sign in
              </button>
            </SignInButton>
          </Show>
        </div>
        <p className="text-sm opacity-80">
          Development harness for the model-call layer. Not a product screen.
        </p>
        <Show when="signed-out">
          <p className="rounded border border-current/40 p-3 text-sm">
            Sending a prompt needs an account. Reading a thread never will.
          </p>
        </Show>
      </header>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="model-id">
          Model id
        </label>
        <input
          id="model-id"
          className="rounded border border-current/30 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          rows={3}
          className="rounded border border-current/30 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="rounded border border-current px-4 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          onClick={() => void run()}
          disabled={status === "streaming" || prompt.trim() === ""}
        >
          {status === "streaming" ? "Streaming…" : "Send"}
        </button>
        <button
          type="button"
          className="rounded border border-current/40 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          onClick={() => abortRef.current?.abort()}
          disabled={status !== "streaming"}
        >
          Stop
        </button>
      </div>

      <output aria-live="polite" className="flex flex-col gap-4">
        {problem !== null ? (
          <p role="alert" className="rounded border border-current/40 p-3">
            {problem.message}
            {problem.retryable ? " You can try again." : ""}
          </p>
        ) : null}

        {answer !== "" ? (
          <p className="rounded border border-current/20 p-3 whitespace-pre-wrap">{answer}</p>
        ) : null}

        {metrics !== null ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt>Time to first token</dt>
            <dd>{ms(metrics.timeToFirstTokenMs)}</dd>
            <dt>Generation time</dt>
            <dd>{ms(metrics.generationMs)}</dd>
            <dt>Total time</dt>
            <dd>{ms(metrics.totalMs)}</dd>
            <dt>Speed, end to end</dt>
            <dd>{rate(metrics.endToEndTokensPerSecond)}</dd>
            <dt>Generation speed</dt>
            <dd>
              {metrics.streamed ? (
                rate(metrics.tokensPerSecond)
              ) : (
                // Saying why it is blank beats an unexplained dash. The answer
                // arrived in one piece, so there is no speed to report.
                <span>
                  — <span className="opacity-70">arrived in one chunk</span>
                </span>
              )}
            </dd>
            <dt>Chunks received</dt>
            <dd>{metrics.deltaCount}</dd>
            <dt>Input tokens</dt>
            <dd>{count(metrics.inputTokens)}</dd>
            <dt>Output tokens</dt>
            <dd>{count(metrics.outputTokens)}</dd>
            <dt>…written</dt>
            <dd>{count(metrics.textTokens)}</dd>
            <dt>…reasoning</dt>
            <dd>{count(metrics.reasoningTokens)}</dd>
            <dt>Total tokens</dt>
            <dd>{count(metrics.totalTokens)}</dd>
          </dl>
        ) : null}
      </output>
    </section>
  );
};
