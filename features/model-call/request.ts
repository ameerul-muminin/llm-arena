import type { ModelCallRequest } from "./types";

/**
 * Validation for the request body. Pure, and strict on purpose: both fields are
 * caller-supplied, so nothing gets looked up or forwarded to a provider on the
 * strength of merely being present.
 *
 * The body is two ids and nothing else. The conversation is not sent — see
 * `ModelCallRequest` for why — so this file no longer validates messages, and
 * the shape a caller could lie about is down to "which turn" and "which model".
 * Both are then checked against the database, which is the real gate; this is
 * the cheap one that runs first.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** OpenRouter ids look like `vendor/model` or `vendor/model:free`. */
const MODEL_ID = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+)?$/;

/** `cuid(2)`, as the schema generates them everywhere. */
const TURN_ID = /^[a-z0-9]{8,64}$/i;

export type ParsedRequest =
  | { readonly ok: true; readonly request: ModelCallRequest }
  | { readonly ok: false; readonly reason: string };

export const parseModelCallRequest = (body: unknown): ParsedRequest => {
  if (!isRecord(body)) return { ok: false, reason: "Expected a JSON object." };
  if (typeof body.turnId !== "string" || !TURN_ID.test(body.turnId)) {
    return { ok: false, reason: "Expected `turnId` to be an id." };
  }
  if (typeof body.modelId !== "string" || !MODEL_ID.test(body.modelId)) {
    return { ok: false, reason: "Expected `modelId` to look like `vendor/model`." };
  }

  return { ok: true, request: { turnId: body.turnId, modelId: body.modelId } };
};
