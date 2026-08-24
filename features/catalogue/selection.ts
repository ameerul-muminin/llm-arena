import type { CatalogueModel } from "./types";

/**
 * Which models the arena starts with, and how many it will hold.
 *
 * The cap is a real product rule, not a placeholder: three answers side by side
 * is what the screen is built around.
 *
 * The default is the top of the context sort, taking one model per vendor. It is
 * fully deterministic and it is still exactly the sort the picker shows — the
 * vendor rule only ever decides between models that were already adjacent. What
 * it buys is visible on the live list: a flat top-three currently returns two
 * NVIDIA Nemotrons, and a bench where two of the three instruments come from the
 * same lab is a weaker comparison for no gain.
 */

export const MAX_MODELS = 3;

/**
 * The line-up a caller asked for, checked against what is actually on offer.
 *
 * The picker already enforces all of this, and that is exactly why it has to be
 * enforced again here: the picker is a control in someone's browser, and the
 * action behind it takes an array of strings from whoever calls it. Without this
 * a crafted request could open a thread against ten models, or the same model
 * three times, or a model nobody is offering for free — and the thread stores
 * the line-up, so every turn afterwards would keep dispatching it.
 *
 * The three rules each stop something concrete:
 *
 * - **Deduplicated**, because the same slug twice is two provider calls racing
 *   to upsert one row, on a unique `(turn, model)` index that only one can win.
 * - **Capped at `MAX_MODELS`**, because the cap is a real product rule and
 *   without it one prompt is as many provider calls as someone cares to name.
 * - **Present in the live free list**, because "every model here is free tier"
 *   is a promise this app makes on every card it prints, and price is the only
 *   thing that makes it true.
 *
 * Pure, over a catalogue the caller supplies, so the rule is readable in one
 * place and the fetch stays at the edge.
 */
export type LineUpCheck =
  | { readonly ok: true; readonly modelIds: readonly string[] }
  | { readonly ok: false; readonly message: string };

export const checkLineUp = (
  offered: readonly CatalogueModel[],
  requested: readonly string[],
): LineUpCheck => {
  const unique = [...new Set(requested)];

  if (unique.length === 0) return { ok: false, message: "Pick at least one model to ask." };
  if (unique.length > MAX_MODELS) {
    return { ok: false, message: `A thread can compare at most ${String(MAX_MODELS)} models.` };
  }

  const offeredIds = new Set(offered.map((model) => model.modelId));
  if (unique.some((modelId) => !offeredIds.has(modelId))) {
    return { ok: false, message: "That isn't one of the free models on offer right now." };
  }

  return { ok: true, modelIds: unique };
};

/**
 * The backfill matters on a thin list. If OpenRouter is only serving two vendors
 * that day, one-per-vendor alone would open the arena with two models and no
 * explanation — so the remaining slots are filled from the same sorted list. A
 * repeated vendor is a preference; an empty slot would look like a bug.
 */
export const defaultSelection = (models: readonly CatalogueModel[]): readonly CatalogueModel[] => {
  const oneEachVendor = models.reduce<readonly CatalogueModel[]>(
    (picked, model) =>
      picked.length >= MAX_MODELS || picked.some((pick) => pick.vendorKey === model.vendorKey)
        ? picked
        : [...picked, model],
    [],
  );

  if (oneEachVendor.length >= MAX_MODELS) return oneEachVendor;

  const remaining = models.filter(
    (model) => !oneEachVendor.some((pick) => pick.modelId === model.modelId),
  );

  return [...oneEachVendor, ...remaining].slice(0, MAX_MODELS);
};
