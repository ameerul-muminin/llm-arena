import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getFreeModels } from "@/features/catalogue/catalogue";
import { CATALOGUE_EMPTY, CATALOGUE_UNAVAILABLE } from "@/features/catalogue/copy";
import { CatalogueRetry } from "@/features/catalogue/retry";
import { EM_DASH, FREE_TIER_COST, formatTokens } from "@/features/design/format";
import { ModelMark } from "@/features/design/model-mark";

/**
 * The full catalogue, so anyone can browse the list without opening the picker.
 *
 * The same `getFreeModels()` the picker reads, in the same order, so the two can
 * never disagree about what is free. That matters more than it sounds: free
 * slugs rot, and this project has already watched four models stop being free
 * and start answering 404.
 */

export const metadata: Metadata = {
  title: "Models — LLM Arena",
};

/*
 * Rendered per request so the catalogue's retry is real — the reason is measured
 * and written down in `features/catalogue/catalogue.ts`. The fetch itself is
 * still cached for an hour and shared by every visitor.
 */
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const catalogue = await getFreeModels();
  const models = catalogue.ok ? catalogue.models : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-8 sm:px-4">
      <div>
        <h1 className="text-display font-semibold tracking-tight text-ink">Models</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">
          Every model you can put in the arena, largest context window first. Free here means
          OpenRouter prices both the prompt and the answer at zero, which is why the cost below
          reads {FREE_TIER_COST} — a real number, not a missing one.
        </p>
      </div>

      {!catalogue.ok && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-detail text-ink-muted">{CATALOGUE_UNAVAILABLE}</p>
          <CatalogueRetry />
        </div>
      )}

      {catalogue.ok && models.length === 0 && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-detail text-ink-muted">
          {CATALOGUE_EMPTY}
        </p>
      )}

      {models.length > 0 && (
        <>
          <p className="eyebrow text-ink-muted">
            <span className="measured">{models.length}</span> models, live from OpenRouter
          </p>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <li key={model.modelId}>
                <Card className="h-full ring-1 ring-line">
                  <CardHeader className="flex items-center gap-2">
                    <ModelMark modelId={model.modelId} />
                    <div className="min-w-0">
                      <h2 className="truncate text-detail font-medium text-ink">
                        {model.modelName}
                      </h2>
                      <p className="truncate eyebrow text-ink-muted">{model.vendor}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="eyebrow text-ink-muted">Context</dt>
                        <dd className="measured text-detail text-ink">
                          {model.contextWindow === null
                            ? EM_DASH
                            : `${formatTokens(model.contextWindow)} tokens`}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="eyebrow text-ink-muted">Cost</dt>
                        <dd className="measured text-detail text-ink">{FREE_TIER_COST}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="eyebrow text-ink-muted">Slug</dt>
                        <dd className="truncate measured text-micro text-ink-muted">
                          {model.modelId}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
