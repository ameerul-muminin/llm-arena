import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EM_DASH, FREE_TIER_COST, formatTokens } from "@/features/design/format";
import { ModelMark } from "@/features/design/model-mark";
import { PlaceholderNote } from "@/features/shell/placeholder-note";

/**
 * The full catalogue, so anyone can browse the list without opening the picker.
 *
 * Fixture cards for now. The real page reads OpenRouter's live free-tier list —
 * which matters more than it sounds, because free-tier slugs rot: this project
 * has already had two models stop being free and start answering 404.
 */

export const metadata: Metadata = {
  title: "Models — LLM Arena",
};

type CatalogueEntry = {
  readonly modelId: string;
  readonly modelName: string;
  readonly vendor: string;
  readonly contextWindow: number | null;
};

const FIXTURE_CATALOGUE: readonly CatalogueEntry[] = [
  {
    modelId: "google/gemma-4-31b-it:free",
    modelName: "Gemma 4 31B",
    vendor: "Google",
    contextWindow: 131072,
  },
  {
    modelId: "qwen/qwen3-14b:free",
    modelName: "Qwen3 14B",
    vendor: "Qwen",
    contextWindow: 40960,
  },
  {
    modelId: "meta-llama/llama-3.3-8b-instruct:free",
    modelName: "Llama 3.3 8B",
    vendor: "Meta",
    contextWindow: null,
  },
];

export default function ModelsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-8 sm:px-4">
      <div>
        <h1 className="text-display font-semibold tracking-tight text-ink">Models</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">
          Every model you can put in the arena. All of them are free tier, which is why the cost
          below reads {FREE_TIER_COST} — that is a real number, not a missing one.
        </p>
      </div>

      <PlaceholderNote>
        Three fixed models, hand-written. The real list comes from OpenRouter&rsquo;s live free-tier
        catalogue, sorted by context window — which matters, because free slugs stop being free
        without warning.
      </PlaceholderNote>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIXTURE_CATALOGUE.map((entry) => (
          <li key={entry.modelId}>
            <Card className="h-full ring-1 ring-line">
              <CardHeader className="flex items-center gap-2">
                <ModelMark modelId={entry.modelId} />
                <div className="min-w-0">
                  <h2 className="truncate text-detail font-medium text-ink">{entry.modelName}</h2>
                  <p className="eyebrow text-ink-muted">{entry.vendor}</p>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="eyebrow text-ink-muted">Context</dt>
                    <dd className="measured text-detail text-ink">
                      {entry.contextWindow === null
                        ? EM_DASH
                        : `${formatTokens(entry.contextWindow)} tokens`}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="eyebrow text-ink-muted">Cost</dt>
                    <dd className="measured text-detail text-ink">{FREE_TIER_COST}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="eyebrow text-ink-muted">Slug</dt>
                    <dd className="truncate measured text-micro text-ink-muted">{entry.modelId}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
