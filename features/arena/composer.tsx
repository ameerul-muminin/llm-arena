"use client";

import { ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ModelMark } from "@/features/design/model-mark";
import { cn } from "@/lib/utils";
import { FIXTURES } from "./fixtures";

/**
 * The prompt box, its model chips, and the send control.
 *
 * Strictly the frame: what you can type into and take models out of is real,
 * because those are the parts someone has to use to judge the screen. Sending is
 * feature 6's and the send control is disabled with the reason stated next to
 * it, rather than looking live and doing nothing when pressed.
 *
 * The cap at three models is a real rule, not a placeholder one — it comes
 * straight from the product and the picker will enforce the same thing when it
 * reads the live catalogue in feature 5.
 */

const MAX_MODELS = 3;

type ChosenModel = { readonly modelId: string; readonly modelName: string };

const ALL_MODELS: readonly ChosenModel[] = FIXTURES.map((fixture) => ({
  modelId: fixture.modelId,
  modelName: fixture.modelName,
}));

export const Composer = ({ className }: { readonly className?: string }) => {
  const [prompt, setPrompt] = useState("");
  const [chosen, setChosen] = useState<readonly ChosenModel[]>(ALL_MODELS);

  const available = ALL_MODELS.filter(
    (model) => !chosen.some((pick) => pick.modelId === model.modelId),
  );
  const atCap = chosen.length >= MAX_MODELS;

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
        rows={2}
        placeholder="Ask anything. Enter to send, shift + enter for a new line."
        className="min-h-16 resize-none border-0 bg-transparent p-1 text-body shadow-none focus-visible:ring-0"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {chosen.map((model) => (
          <span
            key={model.modelId}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised py-0.5 pr-1 pl-1"
          >
            <ModelMark modelId={model.modelId} className="size-5" />
            <span className="text-detail text-ink-muted">{model.modelName}</span>
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
          </span>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="xs" disabled={atCap}>
              <Plus aria-hidden="true" />
              Add model
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <p className="eyebrow text-ink-muted">Free tier</p>
            <ul className="mt-3 space-y-1">
              {available.map((model) => (
                <li key={model.modelId}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setChosen((current) => [...current, model]);
                    }}
                  >
                    <ModelMark modelId={model.modelId} className="size-5" />
                    {model.modelName}
                  </Button>
                </li>
              ))}
              {available.length === 0 && (
                <li className="px-2 py-1 text-detail text-ink-muted">
                  Every model in the list is already in this thread.
                </li>
              )}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-detail text-ink-muted">
              Three fixed models for now. The real picker reads OpenRouter&rsquo;s live free-tier
              catalogue and sorts it by context window.
            </p>
          </PopoverContent>
        </Popover>

        <Button
          size="icon"
          className="ml-auto rounded-full"
          disabled
          aria-describedby="send-not-wired"
        >
          <ArrowUp aria-hidden="true" />
          <span className="sr-only">Send prompt</span>
        </Button>
      </div>

      <p id="send-not-wired" className="mt-2 text-detail text-ink-muted">
        Typing and choosing models work. Sending doesn&rsquo;t yet — that arrives with real
        streaming.
      </p>
    </div>
  );
};
