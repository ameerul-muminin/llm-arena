/**
 * What this app needs to know about a model it can put in the arena, and
 * nothing more.
 *
 * This is the contract between the catalogue and everything downstream of it —
 * the picker, the `/models` page, and the default selection. OpenRouter's own
 * response carries far more (descriptions, tokenizers, supported parameters,
 * per-request limits); none of it is displayed, so none of it is carried.
 */

export type CatalogueModel = {
  /** The slug a model call is made with: `vendor/model` or `vendor/model:tag`. */
  readonly modelId: string;
  /** `Nemotron 3 Ultra` — the provider's own name, with its vendor prefix and free suffix removed. */
  readonly modelName: string;
  /** `NVIDIA` — how the vendor writes its own name. For reading. */
  readonly vendor: string;
  /**
   * `nvidia` — the vendor segment of the slug. For comparing.
   *
   * Two separate fields because the display name is prose the provider chose and
   * can drop the prefix entirely, while the slug segment is always present and
   * always canonical. The default selection takes one model per vendor, and that
   * has to be decided on the reliable one.
   */
  readonly vendorKey: string;
  /** `null` if the provider did not state one, and then it renders as an em dash. */
  readonly contextWindow: number | null;
};

/**
 * Either the live list, or the honest absence of it.
 *
 * A failed catalogue fetch is not an empty catalogue, and the two must not
 * collapse into one `readonly CatalogueModel[]` — "OpenRouter lists no free
 * models" and "we could not reach OpenRouter" are different facts and the screen
 * says a different sentence for each.
 */
export type Catalogue =
  { readonly ok: true; readonly models: readonly CatalogueModel[] } | { readonly ok: false };
