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
