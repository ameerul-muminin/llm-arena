"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CATALOGUE_EMPTY, CATALOGUE_UNAVAILABLE } from "@/features/catalogue/copy";
import { CatalogueRetry } from "@/features/catalogue/retry";
import { defaultSelection, MAX_MODELS } from "@/features/catalogue/selection";
import type { Catalogue, CatalogueModel } from "@/features/catalogue/types";
import { formatTokens } from "@/features/design/format";
import { ModelMark } from "@/features/design/model-mark";
import { cn } from "@/lib/utils";

/**
 * The prompt box, its model chips, and the send control.
 *
 * **The line-up locks once a thread has been started.** Before that the chips
 * are a control; afterwards they are a readout of who is in this thread, and
 * changing the cast means starting a new one. A thread is one sample run on a
 * fixed set of instruments — that is what makes the top bar's win records
 * describe a stable group, and what keeps a follow-up a genuine like-for-like
 * comparison rather than a new question put to a different room.
 *
 * Sending needs an account, and the control says so up front rather than
 * failing after the fact. The route refuses a signed-out caller regardless;
 * this is the courtesy, not the enforcement.
 *
 * The picker states the context window next to every model rather than only
 * sorting by it. A list ordered by a number the reader cannot see is a list
 * that looks arbitrary, and the number is a measured fact about the model, so
 * it is shown in mono like every other measured fact in this app.
 */

/** A model in a thread that already exists: named, and not up for changing. */
export type LineUpModel = { readonly modelId: string; readonly modelName: string };

type ComposerProps = {
  readonly catalogue: Catalogue;
  /** The thread's fixed line-up, or null while the thread does not exist yet. */
  readonly lineUp: readonly LineUpModel[] | null;
  /** Resolves to true when the prompt was accepted, which is when to clear the box. */
  readonly onSend: (prompt: string, modelIds: readonly string[]) => Promise<boolean>;
  readonly sending: boolean;
  readonly error: string | null;
  readonly className?: string;
};

export const Composer = ({
  catalogue,
  lineUp,
  onSend,
  sending,
  error,
  className,
}: ComposerProps) => {
  const [prompt, setPrompt] = useState("");

  const models: readonly CatalogueModel[] = catalogue.ok ? catalogue.models : [];

  // The default is computed once, as the initial state, and is not a live
  // derivation of the catalogue: once someone has taken a model out, a re-render
  // must not put it back.
  const [chosen, setChosen] = useState<readonly CatalogueModel[]>(() => defaultSelection(models));

  const locked = lineUp !== null;
  const shown: readonly LineUpModel[] = lineUp ?? chosen;

  const available = models.filter(
    (model) => !chosen.some((pick) => pick.modelId === model.modelId),
  );
  const atCap = chosen.length >= MAX_MODELS;
  const canSend = prompt.trim() !== "" && shown.length > 0 && !sending;

  const submit = () => {
    if (!canSend) return;
    void onSend(
      prompt,
      shown.map((model) => model.modelId),
    ).then((sent) => {
      // Only cleared once the prompt is genuinely on its way. A refused send
      // that wiped the box would lose what someone just wrote.
      if (sent) setPrompt("");
    });
  };

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-3", className)}>
      <label htmlFor="prompt" className="sr-only">
        Your prompt
      </label>
      <Textarea
        id="prompt"
        value={prompt}
        onChange={(event) => {
          setPrompt(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Ask anything. Enter to send, shift + enter for a new line."
        className="min-h-16 resize-none border-0 bg-transparent p-1 text-body shadow-none focus-visible:ring-0"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {shown.map((model) => (
          <span
            key={model.modelId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised py-0.5 pl-1",
              locked ? "pr-2.5" : "pr-1",
            )}
          >
            <ModelMark modelId={model.modelId} className="size-5" />
            <span className="text-detail text-ink-muted">{model.modelName}</span>
            {!locked && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={`Remove ${model.modelName}`}
                onClick={() => {
                  setChosen((current) => current.filter((pick) => pick.modelId !== model.modelId));
                }}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </span>
        ))}

        {!locked && models.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="xs" disabled={atCap || available.length === 0}>
                <Plus aria-hidden="true" />
                Add model
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <div className="flex items-baseline justify-between gap-3">
                <p className="eyebrow text-ink-muted">Free tier</p>
                <p className="eyebrow text-ink-muted">Context</p>
              </div>

              <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
                {available.map((model) => (
                  <li key={model.modelId}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto w-full justify-start gap-2 py-1.5"
                      onClick={() => {
                        setChosen((current) => [...current, model]);
                      }}
                    >
                      <ModelMark modelId={model.modelId} className="size-5" />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-detail text-ink">
                          {model.modelName}
                        </span>
                        <span className="block truncate eyebrow text-ink-muted">
                          {model.vendor}
                        </span>
                      </span>
                      <span className="measured text-micro text-ink-muted">
                        {formatTokens(model.contextWindow)}
                      </span>
                    </Button>
                  </li>
                ))}
                {available.length === 0 && (
                  <li className="px-2 py-1 text-detail text-ink-muted">
                    Every free model is already in this thread.
                  </li>
                )}
              </ul>

              <p className="mt-3 border-t border-line pt-3 text-detail text-ink-muted">
                <span className="measured">{models.length}</span> free models, live from OpenRouter,
                largest context first.
              </p>
            </PopoverContent>
          </Popover>
        )}

        {!locked && !catalogue.ok && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-detail text-ink-muted">{CATALOGUE_UNAVAILABLE}</span>
            <CatalogueRetry />
          </span>
        )}

        {!locked && catalogue.ok && models.length === 0 && (
          <span className="text-detail text-ink-muted">{CATALOGUE_EMPTY}</span>
        )}

        <span className="ml-auto">
          <Show when="signed-in">
            <Button
              size="icon"
              className="rounded-full"
              disabled={!canSend}
              onClick={submit}
              aria-label={sending ? "Sending" : "Send prompt"}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button size="sm">Sign in to send</Button>
            </SignInButton>
          </Show>
        </span>
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 text-detail text-fail">
          {error}
        </p>
      )}

      {locked && (
        <p className="mt-2 text-detail text-ink-muted">
          This thread asks these models. Start a new thread to compare a different line-up.
        </p>
      )}
    </div>
  );
};
