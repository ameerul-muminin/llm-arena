import { cn } from "@/lib/utils";
import { ARRIVED_IN_ONE_CHUNK, formatMs } from "./format";

/**
 * The one thing this app is meant to be remembered by.
 *
 * Every answer in a turn draws its own track, and **all of them share one time
 * scale** — the slowest finisher in that turn fills the width, everyone else is
 * drawn against it. So three cards side by side are a race chart drawn in place,
 * and the two speed numbers feature 1 went to such trouble to measure honestly
 * become something you watch happen rather than something you read afterwards.
 *
 * Line weight carries the meaning, which is what keeps it honest:
 *
 * - **1px** — time passing with nothing to show for it yet. Real elapsed time,
 *   never a progress bar; we have no idea how far along a model is.
 * - **3px band** — text genuinely arriving, spanning the window it arrived in.
 * - **a tall solid mark** — the answer landed in one flush. A model that buffers
 *   has no generation window, so it gets no band. That is the same fact
 *   `streamed: false` states, drawn instead of written.
 * - **fail-colored, stopping short** — the call ended where the line ends. No
 *   invented endpoint.
 *
 * Drawn in neutral tones on purpose. Rust marks what you interact with plus the
 * win-rate bar the brief names explicitly; letting a measurement borrow it would
 * spread the accent until it stopped meaning anything.
 */

export type AxisOutcome = "running" | "finished" | "failed";

export type AxisSpan = {
  /** Dispatch until the first text delta. `null` while still waiting. */
  readonly timeToFirstTokenMs: number | null;
  /** First delta until the last. `null` for a buffered answer, which has none. */
  readonly generationMs: number | null;
  /** How long this call has been running, or ran in total. Always known. */
  readonly elapsedMs: number;
  /** Whether the answer genuinely arrived over time rather than in one flush. */
  readonly streamed: boolean;
  readonly outcome: AxisOutcome;
};

type TimeAxisProps = {
  readonly span: AxisSpan;
  /**
   * The turn's slowest finisher, in milliseconds. Every card in a turn must be
   * passed the same value — that shared denominator is the entire idea.
   */
  readonly scaleMs: number;
  readonly className?: string;
};

const percent = (ms: number, scaleMs: number): number =>
  scaleMs <= 0 ? 0 : Math.min(100, Math.max(0, (ms / scaleMs) * 100));

/**
 * What the axis says out loud, in the interface's own voice. A blank would read
 * as a bug; "arrived in one chunk" reads as the measurement it is.
 */
const caption = ({ timeToFirstTokenMs, streamed, outcome, elapsedMs }: AxisSpan): string => {
  if (outcome === "failed") return `stopped at ${formatMs(elapsedMs)}`;
  if (timeToFirstTokenMs === null) return "waiting";
  if (outcome === "finished" && !streamed) return ARRIVED_IN_ONE_CHUNK;
  return `${formatMs(timeToFirstTokenMs)} to first token`;
};

export const TimeAxis = ({ span, scaleMs, className }: TimeAxisProps) => {
  const { timeToFirstTokenMs, generationMs, elapsedMs, streamed, outcome } = span;

  const failed = outcome === "failed";
  const waitEnd = percent(timeToFirstTokenMs ?? elapsedMs, scaleMs);
  const firstToken = timeToFirstTokenMs === null ? null : percent(timeToFirstTokenMs, scaleMs);

  /* While streaming, the band grows to now. Once finished, it spans the window
     that was actually measured, not to wherever the stream happened to close. */
  const bandEnd =
    timeToFirstTokenMs === null
      ? null
      : outcome === "running"
        ? percent(elapsedMs, scaleMs)
        : generationMs === null
          ? null
          : percent(timeToFirstTokenMs + generationMs, scaleMs);

  const showFlushMark = outcome === "finished" && !streamed && firstToken !== null;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-3.5" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-axis-track" />

        {/* Time passing. One pixel, because nothing has been produced yet. */}
        <div
          className={cn(
            "absolute top-1/2 left-0 h-px -translate-y-1/2 transition-[width] duration-200",
            failed ? "bg-fail" : "bg-axis-fill",
          )}
          style={{ width: `${waitEnd}%` }}
        />

        {/* Text arriving, over the window it arrived in. */}
        {bandEnd !== null && firstToken !== null && !showFlushMark && (
          <div
            className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-axis-fill transition-[left,width] duration-200"
            style={{ left: `${firstToken}%`, width: `${Math.max(0, bandEnd - firstToken)}%` }}
          />
        )}

        {/* First token. */}
        {firstToken !== null && !showFlushMark && (
          <div
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-axis-mark"
            style={{ left: `${firstToken}%` }}
          />
        )}

        {/* One flush, and therefore no window to draw a band across. */}
        {showFlushMark && (
          <div
            className="absolute top-1/2 h-2.5 w-[3px] -translate-x-px -translate-y-1/2 rounded-[1px] bg-axis-mark"
            style={{ left: `${firstToken}%` }}
          />
        )}

        {/* Where a failed call actually stopped. */}
        {failed && (
          <div
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-fail"
            style={{ left: `${waitEnd}%` }}
          />
        )}
      </div>

      <p className={cn("mt-1 eyebrow leading-none", failed ? "text-fail" : "text-ink-muted")}>
        {caption(span)}
      </p>
    </div>
  );
};

/**
 * The shared denominator, computed once per turn and handed to every card. A
 * floor keeps a turn where everything landed instantly from dividing by
 * something near zero — the same class of bug feature 1 hit with `tokensPerSecond`.
 */
export const axisScaleFor = (spans: readonly AxisSpan[]): number =>
  Math.max(250, ...spans.map((span) => span.elapsedMs));
