import "server-only";

/**
 * Every write. Three rules hold across all of them.
 *
 * **Nothing here trusts the browser with a number.** Metrics are the whole basis
 * of the leaderboard, so a client-supplied one is a forgeable one. These
 * functions are called from the server side of a model call, with the metrics
 * the server measured — the same reasoning that removed the client-supplied
 * distinct-id header from the model-call route.
 *
 * **The thread and turn are created before the models are called, never during.**
 * A prompt sent to three models is three independent requests; if each one
 * created the turn it needed, they would race for it. One write up front, then
 * three responses landing against a turn that already exists.
 *
 * **A refused write is a value, not an exception.** See `refusals.ts`.
 */

import type { ModelCallFailureKind, ModelMetrics } from "@/features/model-call/types";
import { prisma } from "@/lib/prisma";

import { toStoredFailureKind } from "./failure-kind";
import { toMetricsColumns } from "./mappers";
import type { MetricsColumns } from "./mappers";
import { refuse, succeed } from "./refusals";
import type { WriteResult } from "./refusals";

/** Nothing to compare below two answers, so there is nothing to vote on. */
const MIN_ANSWERS_TO_VOTE = 2;

/**
 * A failed response has no metrics at all. Written out explicitly on every
 * failure so that retrying a model that previously answered cannot leave the
 * old numbers sitting under the new failure.
 */
const NO_METRICS: MetricsColumns = {
  timeToFirstTokenMs: null,
  generationMs: null,
  totalMs: null,
  deltaCount: null,
  streamed: null,
  tokensPerSecond: null,
  endToEndTokensPerSecond: null,
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  textTokens: null,
  totalTokens: null,
};

export const createThread = async (input: {
  readonly ownerId: string;
  readonly prompt: string;
  /** The line-up, fixed here and never changed again. */
  readonly modelIds: readonly string[];
}): Promise<{ readonly threadId: string; readonly turnId: string }> => {
  const thread = await prisma.thread.create({
    data: {
      ownerId: input.ownerId,
      modelIds: [...input.modelIds],
      turns: { create: { ordinal: 0, prompt: input.prompt } },
    },
    select: { id: true, turns: { select: { id: true } } },
  });

  // The nested create above guarantees exactly one turn. If it is ever missing,
  // the database disagrees with Prisma about what just happened, and carrying
  // on with a fabricated id would hide that. `at` rather than `[0]` because
  // Prisma types the array as always-populated, which makes the honest check
  // look like dead code to the linter.
  const turn = thread.turns.at(0);
  if (turn === undefined) throw new Error("Thread was created without its first turn");

  return { threadId: thread.id, turnId: turn.id };
};

/**
 * The next ordinal comes from the current maximum rather than a count, so a
 * turn removed at any point in the future cannot make the next one collide with
 * an existing position.
 *
 * **A thread with no line-up at all can still be given one, and only then.**
 * That is not a hole in the lock; it is the lock stated precisely. The line-up
 * is fixed so that a thread's comparison stays a comparison between the same
 * models, and a thread that has never had a line-up has no comparison to
 * protect. The only way to be in that state is to predate the `modelIds`
 * column and to have never received a single response — a thread whose prompt
 * exists and whose answers never did. Refusing to let its owner ask anyone
 * would strand it forever for the sake of protecting nothing.
 *
 * The emptiness is re-checked inside the transaction rather than outside it, so
 * two follow-ups sent at once cannot each decide the thread is unclaimed and
 * write a different line-up.
 */
export const appendTurn = async (input: {
  readonly threadId: string;
  readonly ownerId: string;
  readonly prompt: string;
  /** Used only if the thread has no line-up yet. Ignored otherwise. */
  readonly adoptModelIds?: readonly string[];
}): Promise<
  WriteResult<{
    readonly turnId: string;
    readonly ordinal: number;
    /** Who this turn should actually be sent to. */
    readonly modelIds: readonly string[];
  }>
> =>
  prisma.$transaction(async (tx) => {
    const thread = await tx.thread.findUnique({
      where: { id: input.threadId },
      select: { ownerId: true, modelIds: true },
    });
    if (thread === null) return refuse("thread-not-found");
    if (thread.ownerId !== input.ownerId) return refuse("not-owner");

    const adopting = thread.modelIds.length === 0 && (input.adoptModelIds ?? []).length > 0;
    const modelIds = adopting ? (input.adoptModelIds ?? []) : thread.modelIds;

    if (modelIds.length === 0) return refuse("no-models");

    if (adopting) {
      await tx.thread.update({
        where: { id: input.threadId },
        data: { modelIds: [...modelIds] },
      });
    }

    const { _max } = await tx.turn.aggregate({
      where: { threadId: input.threadId },
      _max: { ordinal: true },
    });

    const turn = await tx.turn.create({
      data: {
        threadId: input.threadId,
        ordinal: (_max.ordinal ?? -1) + 1,
        prompt: input.prompt,
      },
      select: { id: true, ordinal: true },
    });

    return succeed({ turnId: turn.id, ordinal: turn.ordinal, modelIds });
  });

/**
 * Both recording functions upsert on (turn, model), because retrying a model on
 * the same prompt should replace what it said rather than add a second answer
 * the vote would then have to choose between.
 */
export const recordAnswer = async (input: {
  readonly turnId: string;
  readonly modelId: string;
  readonly text: string;
  readonly metrics: ModelMetrics;
}): Promise<void> => {
  const data = {
    status: "ANSWERED",
    text: input.text,
    failureKind: null,
    ...toMetricsColumns(input.metrics),
  } as const;

  await prisma.modelResponse.upsert({
    where: { turnId_modelId: { turnId: input.turnId, modelId: input.modelId } },
    create: { turnId: input.turnId, modelId: input.modelId, ...data },
    update: data,
  });
};

export const recordFailure = async (input: {
  readonly turnId: string;
  readonly modelId: string;
  readonly kind: ModelCallFailureKind;
  /** Whatever had arrived before it broke; null when nothing had. */
  readonly partialText: string | null;
}): Promise<void> => {
  const data = {
    status: "FAILED",
    text: input.partialText,
    failureKind: toStoredFailureKind(input.kind),
    ...NO_METRICS,
  } as const;

  await prisma.modelResponse.upsert({
    where: { turnId_modelId: { turnId: input.turnId, modelId: input.modelId } },
    create: { turnId: input.turnId, modelId: input.modelId, ...data },
    update: data,
  });
};

/**
 * The one write with real rules, all four checked in a single transaction.
 *
 * "At least two models answered" is the one the schema cannot express — a
 * constraint on a row's existence in terms of a sibling table's contents needs
 * a trigger or a denormalised counter, and neither is worth the machinery. It
 * lives here instead, and this comment is the record of that gap.
 *
 * The winner belonging to this turn *is* enforced by the database, through the
 * composite foreign key on (winningResponseId, turnId). The check below exists
 * to turn that into a plain sentence rather than a constraint violation, not to
 * be the only thing standing in the way.
 */
export const castVote = async (input: {
  readonly turnId: string;
  readonly voterId: string;
  readonly winningResponseId: string;
}): Promise<WriteResult<{ readonly voteId: string }>> =>
  prisma.$transaction(async (tx) => {
    const turn = await tx.turn.findUnique({
      where: { id: input.turnId },
      select: {
        thread: { select: { ownerId: true } },
        vote: { select: { id: true } },
        responses: { select: { id: true, status: true } },
      },
    });

    if (turn === null) return refuse("turn-not-found");
    // Feature 8: a thread is readable by anyone with the link, but only its
    // owner can use it, and voting is using it.
    if (turn.thread.ownerId !== input.voterId) return refuse("not-owner");
    if (turn.vote !== null) return refuse("already-voted");

    const winner = turn.responses.find((response) => response.id === input.winningResponseId);
    if (winner === undefined) return refuse("winner-not-in-turn");
    if (winner.status !== "ANSWERED") return refuse("winner-did-not-answer");

    const answered = turn.responses.filter((response) => response.status === "ANSWERED");
    if (answered.length < MIN_ANSWERS_TO_VOTE) return refuse("too-few-answers");

    const vote = await tx.vote.create({
      data: {
        turnId: input.turnId,
        winningResponseId: input.winningResponseId,
        voterId: input.voterId,
      },
      select: { id: true },
    });

    return succeed({ voteId: vote.id });
  });
