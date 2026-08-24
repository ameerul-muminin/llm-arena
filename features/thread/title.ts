import type { StoredThread } from "./types";

/**
 * What a thread is called on screen.
 *
 * `Thread.title` is nullable because until someone names a thread there is no
 * title, and writing a guess into the column at creation time would bake it in
 * — including into threads whose first prompt turns out to be nothing like what
 * they became. So the fallback happens at render, every time, from the first
 * prompt.
 *
 * Nothing here asks a model to name anything. That would spend a call, add a
 * failure mode, and put an invented sentence where a real one already exists.
 */

/** The last resort, for a thread with a null title and no turns to fall back on. */
const UNTITLED = "Untitled thread";

export const titleFor = (title: string | null, firstPrompt: string | null): string => {
  const named = title?.trim() ?? "";
  if (named !== "") return named;

  const prompt = firstPrompt?.trim() ?? "";
  return prompt === "" ? UNTITLED : prompt;
};

export const threadTitle = (thread: StoredThread): string =>
  titleFor(thread.title, thread.turns.at(0)?.prompt ?? null);
