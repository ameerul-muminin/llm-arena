import type { ChatMessage, ChatRole, ModelCallRequest } from "./types";

/**
 * Validation for the request body. Pure, and strict on purpose: the model id
 * and every message is caller-supplied, so nothing gets forwarded to a provider
 * on the strength of it merely being present.
 */

const ROLES: readonly ChatRole[] = ["system", "user", "assistant"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRole = (value: unknown): value is ChatRole =>
  typeof value === "string" && ROLES.some((role) => role === value);

/** OpenRouter ids look like `vendor/model` or `vendor/model:free`. */
const MODEL_ID = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+)?$/;

const toMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) return null;
  if (!isRole(value.role)) return null;
  if (typeof value.content !== "string" || value.content.trim() === "") return null;
  return { role: value.role, content: value.content };
};

export type ParsedRequest =
  | { readonly ok: true; readonly request: ModelCallRequest }
  | { readonly ok: false; readonly reason: string };

export const parseModelCallRequest = (body: unknown): ParsedRequest => {
  if (!isRecord(body)) return { ok: false, reason: "Expected a JSON object." };
  if (typeof body.modelId !== "string" || !MODEL_ID.test(body.modelId)) {
    return { ok: false, reason: "Expected `modelId` to look like `vendor/model`." };
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, reason: "Expected at least one message." };
  }

  const messages = body.messages.map(toMessage);
  if (messages.some((message) => message === null)) {
    return { ok: false, reason: "Every message needs a valid role and non-empty content." };
  }

  return {
    ok: true,
    request: {
      modelId: body.modelId,
      messages: messages.filter((message): message is ChatMessage => message !== null),
    },
  };
};
