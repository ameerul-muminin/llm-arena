/**
 * One model's own side of a thread, derived rather than stored.
 *
 * Feature 6 says a follow-up continues each model's separate conversation. That
 * does not need a second copy of the history: a thread already holds every
 * prompt in order and every model's answer to each, so a model's conversation
 * is a projection of it. Pure, so the shape of the history is decided in one
 * readable place instead of inside a query.
 *
 * Assumes the thread's turns arrive in order, which every read in `queries.ts`
 * guarantees.
 */

import type { ChatMessage } from "@/features/model-call/types";

import type { AnsweredResponse, StoredResponse, StoredThread } from "./types";

const answeredBy =
  (modelId: string) =>
  (response: StoredResponse): response is AnsweredResponse =>
    response.kind === "answered" && response.modelId === modelId;

/**
 * A turn where this model failed still contributes its prompt, but no assistant
 * message — the person did ask, and dropping that would rewrite the
 * conversation, while inventing a reply it never gave would be worse. Two user
 * messages in a row is valid in the chat format and is the honest
 * representation of "asked twice, answered once".
 */
export const conversationFor = (thread: StoredThread, modelId: string): readonly ChatMessage[] =>
  thread.turns.flatMap((turn): readonly ChatMessage[] => {
    const answer = turn.responses.find(answeredBy(modelId));

    return answer === undefined
      ? [{ role: "user", content: turn.prompt }]
      : [
          { role: "user", content: turn.prompt },
          { role: "assistant", content: answer.text },
        ];
  });
