/**
 * What a leaderboard is made of, in two steps: the tallies the database can
 * produce, and the rows a screen can print.
 *
 * They are separate types because ranking and naming are not the database's
 * job. A `ModelTally` is four counts and two averages against a slug — every
 * field of it came out of SQL. A `LeaderboardRow` adds the two things only this
 * app can supply: what the model is called, and where it placed.
 *
 * Every average is nullable, for the same reason every metric column is. A
 * model that only ever flushed its answer in one chunk reported no generation
 * speed, and a call that failed reported nothing at all. `AVG` skips those
 * rather than counting them as zero, and when it has nothing left to average it
 * returns nothing — which arrives here as `null` and renders as an em dash. No
 * number in this file is ever zero-filled to look complete.
 */

/** One model's record, straight out of the aggregate. */
export type ModelTally = {
  /** OpenRouter slug, as stored on the response. */
  readonly modelId: string;
  /**
   * Turns this model actually answered. Not shown as a column — it is the
   * evidence behind the averages, and the tie-breaker between two models that
   * have both been judged zero times.
   */
  readonly answered: number;
  /**
   * Turns this model answered *and* that were then voted on. The honest
   * denominator: a model that failed on a judged turn was never in that
   * comparison, so counting it there would blame it for a race it did not run.
   */
  readonly judged: number;
  /**
   * Judged turns this model won. Never more than `judged` — which is a property
   * of how it is read, not of the schema: the two counts come from one
   * `RepeatableRead` snapshot, so a vote landing mid-read cannot be counted as a
   * win here and missed as a judgement there.
   */
  readonly won: number;
  readonly avgTimeToFirstTokenMs: number | null;
  /**
   * End-to-end speed, not generation speed, and the name says which. Feature 1
   * settled this: `tokensPerSecond` is `null` by design for a model that
   * buffers, so averaging it would quietly produce a board about streaming
   * models only.
   */
  readonly avgEndToEndTokensPerSecond: number | null;
};

/** A tally with a name and a place, ready to be a table row. */
export type LeaderboardRow = ModelTally & {
  readonly modelName: string;
  /** Its position in the ranked list, from one. */
  readonly place: number;
};
