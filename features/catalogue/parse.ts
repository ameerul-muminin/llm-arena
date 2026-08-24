import type { CatalogueModel } from "./types";

/**
 * OpenRouter's catalogue response, turned into this app's own list. Pure, and
 * strict for the same reason `request.ts` and `wire.ts` are: this is JSON from
 * someone else's server, so nothing is kept on the strength of merely being
 * present. An entry that does not fit is dropped, never patched up — a thinner
 * list is a correct outcome, a crashed page is not.
 *
 * Three filters decide what "free" means here, and each one is a judgement
 * written down rather than a guess:
 *
 *   1. **Price, not the `:free` suffix.** Checked against the live list and the
 *      two genuinely differ — 19 models cost nothing while only 15 carry the
 *      suffix. Price is the fact behind the `$0.0000` this app prints on every
 *      card, so price is what is read.
 *   2. **Text in, text out.** The zero-price set includes music models, which
 *      emit audio. In the arena they would be a card that never produces
 *      anything readable.
 *   3. **No routers.** The `openrouter/` namespace holds models that forward to
 *      whichever model they like. A leaderboard row for one would claim a win
 *      rate for a name that is several models wearing one label, which is
 *      exactly the kind of number this project refuses to print.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Prices arrive as decimal strings — `"0"`, `"0.0000001"` — never as numbers. */
const priceOf = (value: unknown): number | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const contextWindowOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;

const isFree = (pricing: unknown): boolean => {
  if (!isRecord(pricing)) return false;
  const prompt = priceOf(pricing.prompt);
  const completion = priceOf(pricing.completion);
  return prompt === 0 && completion === 0;
};

/**
 * Text in and text out, with nothing else coming out. `every` rather than a
 * plain `includes`, because a model that answers with text *and* audio is not a
 * model this app can show.
 */
const isTextOnly = (architecture: unknown): boolean => {
  if (!isRecord(architecture)) return false;
  const inputs = stringsOf(architecture.input_modalities);
  const outputs = stringsOf(architecture.output_modalities);
  return inputs.includes("text") && outputs.length > 0 && outputs.every((out) => out === "text");
};

/** `NVIDIA: Nemotron 3 Ultra (free)` → vendor `NVIDIA`, name `Nemotron 3 Ultra`. */
const readName = (
  rawName: string,
  vendorKey: string,
): { readonly vendor: string; readonly modelName: string } => {
  const trimmed = rawName.replace(/\s*\(free\)$/i, "").trim();
  const at = trimmed.indexOf(": ");
  const vendor = at === -1 ? "" : trimmed.slice(0, at).trim();
  const modelName = at === -1 ? trimmed : trimmed.slice(at + 2).trim();

  // Some providers write no prefix at all, so the slug's own vendor segment is
  // the fallback. It reads lowercase, which is honest — it is the name we have.
  if (vendor === "" || modelName === "") return { vendor: vendorKey, modelName: trimmed };
  return { vendor, modelName };
};

const toModel = (value: unknown): CatalogueModel | null => {
  if (!isRecord(value)) return null;

  const { id, name } = value;
  if (typeof id !== "string" || typeof name !== "string" || name.trim() === "") return null;

  const segments = id.split("/");
  if (segments.length !== 2) return null;

  const vendorKey = segments.at(0) ?? "";
  const model = segments.at(1) ?? "";
  if (vendorKey === "" || model === "") return null;
  if (vendorKey === "openrouter") return null;

  if (!isFree(value.pricing)) return null;
  if (!isTextOnly(value.architecture)) return null;

  return {
    modelId: id,
    ...readName(name, vendorKey),
    vendorKey,
    contextWindow: contextWindowOf(value.context_length),
  };
};

/**
 * Sorted by context window, largest first, which is the order the picker shows
 * and the order the default selection walks. A model that states no context
 * window sorts last rather than sorting as zero, and the slug breaks a tie so
 * the list is stable between requests instead of reshuffling on every fetch.
 */
const byContextWindow = (a: CatalogueModel, b: CatalogueModel): number => {
  if (a.contextWindow !== b.contextWindow) {
    if (a.contextWindow === null) return 1;
    if (b.contextWindow === null) return -1;
    return b.contextWindow - a.contextWindow;
  }
  return a.modelId.localeCompare(b.modelId);
};

export const parseCatalogue = (payload: unknown): readonly CatalogueModel[] => {
  if (!isRecord(payload)) return [];
  const entries = Array.isArray(payload.data) ? payload.data : [];

  return entries
    .map(toModel)
    .filter((model): model is CatalogueModel => model !== null)
    .sort(byContextWindow);
};
