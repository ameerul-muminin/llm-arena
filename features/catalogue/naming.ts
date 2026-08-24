import type { Catalogue } from "./types";

/**
 * A model's readable name, for a slug that may no longer be in the catalogue.
 *
 * Free-tier slugs rot — feature 5 measured it, two of three hardcoded ids were
 * already gone — and a thread stored last month can name a model this month's
 * list has dropped. It still has to read as something, so the fallback is the
 * slug's own model segment with the `:free` tag removed: the name we actually
 * have, rather than a blank or an invented one.
 *
 * A lookup rather than a map argument, so callers pass the catalogue they
 * already read and nothing has to build an index for three models.
 */

export const modelNameFor = (catalogue: Catalogue, modelId: string): string => {
  const known = catalogue.ok
    ? catalogue.models.find((model) => model.modelId === modelId)
    : undefined;
  if (known !== undefined) return known.modelName;

  const segment = modelId.split("/").at(1) ?? modelId;
  return segment.split(":").at(0) ?? segment;
};

/** The same lookup, curried, for the places that name a whole line-up. */
export const namerFor =
  (catalogue: Catalogue) =>
  (modelId: string): string =>
    modelNameFor(catalogue, modelId);
