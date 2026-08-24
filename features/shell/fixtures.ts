/**
 * Placeholder content for the shell. **None of this is real.**
 *
 * `features/thread/` can already read a person's threads — `listThreadsForOwner`
 * is built and works — but nothing writes one until feature 6, so a live query
 * renders the empty state and nothing else. These fixtures exist so the row
 * design, its truncation, and the crowded case can actually be looked at now
 * rather than first being seen while building the feature that depends on them.
 *
 * Swapping this for the live query is a one-line change in the sidebar, and this
 * file is deleted with it.
 */

export type ThreadRow = {
  readonly id: string;
  readonly title: string;
  /** Shown as marks on the row: you remember a thread by who was in it. */
  readonly modelIds: readonly string[];
  readonly turnCount: number;
};

const GEMMA = "google/gemma-4-31b-it:free";
const QWEN = "qwen/qwen3-14b:free";
const LLAMA = "meta-llama/llama-3.3-8b-instruct:free";

export const FIXTURE_THREADS: readonly ThreadRow[] = [
  {
    id: "t-pull-requests",
    title: "Explaining pull requests",
    modelIds: [GEMMA, QWEN, LLAMA],
    turnCount: 3,
  },
  {
    id: "t-rust-vs-go",
    title: "Rust vs Go for a small CLI",
    modelIds: [GEMMA, QWEN],
    turnCount: 5,
  },
  {
    id: "t-iso-timestamps",
    title: "A regex that matches ISO 8601 timestamps without eating the timezone",
    modelIds: [GEMMA, QWEN, LLAMA],
    turnCount: 1,
  },
  {
    id: "t-postgres-index",
    title: "When a partial index actually helps",
    modelIds: [QWEN, LLAMA],
    turnCount: 2,
  },
];

export type Standing = {
  readonly modelId: string;
  readonly modelName: string;
  readonly won: number;
  readonly judged: number;
};

/** This thread's record so far. Real votes arrive with feature 6. */
export const FIXTURE_STANDINGS: readonly Standing[] = [
  { modelId: GEMMA, modelName: "Gemma 4 31B", won: 2, judged: 3 },
  { modelId: QWEN, modelName: "Qwen3 14B", won: 1, judged: 3 },
  { modelId: LLAMA, modelName: "Llama 3.3 8B", won: 0, judged: 2 },
];

export const FIXTURE_THREAD_TITLE = "Explaining pull requests";
