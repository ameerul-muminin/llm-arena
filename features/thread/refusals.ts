/**
 * A write that will not happen, and the plain sentence that says so.
 *
 * The same shape the model-call feature uses for provider errors, for the same
 * reason: a caller should never have to interpret a database exception, and a
 * person should never see one. Refusals are values, not thrown errors — these
 * are expected outcomes of a legitimate request, not bugs, and returning them
 * makes handling every one of them a typecheck obligation.
 *
 * A genuine fault — the database being unreachable, a constraint we believed
 * unreachable firing — is not in here. That still throws, because it is not an
 * outcome anyone can act on.
 */

export type WriteRefusal =
  | "thread-not-found"
  | "turn-not-found"
  | "not-owner"
  | "already-voted"
  | "no-models"
  | "too-few-answers"
  | "winner-not-in-turn"
  | "winner-did-not-answer";

const SENTENCES: Readonly<Record<WriteRefusal, string>> = {
  "thread-not-found": "That conversation doesn't exist.",
  "turn-not-found": "That prompt doesn't exist.",
  "not-owner": "This conversation belongs to someone else, so you can read it but not add to it.",
  "already-voted": "You've already picked a winner for this prompt.",
  "no-models": "Choose at least one model before sending this.",
  "too-few-answers": "There's nothing to compare yet — at least two models have to answer first.",
  "winner-not-in-turn": "That answer isn't one of the answers to this prompt.",
  "winner-did-not-answer": "That model didn't answer, so it can't win.",
};

export type WriteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: WriteRefusal; readonly message: string };

export const succeed = <T>(value: T): WriteResult<T> => ({ ok: true, value });

export const refuse = <T>(refusal: WriteRefusal): WriteResult<T> => ({
  ok: false,
  refusal,
  message: SENTENCES[refusal],
});
