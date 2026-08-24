import { cn } from "@/lib/utils";
import { EM_DASH, formatWinRate, formatWinRecord, winRate } from "./format";

/**
 * The leaderboard's headline number, and the one measurement the brief lets wear
 * rust without being interactive.
 *
 * The rate is always accompanied by the count it came from. A percentage on its
 * own is the dishonest version — "50%" and "won 1 of 2" are the same fact, and
 * only one of them admits how little has been judged. Feature 9's rule that the
 * denominator is turns that were *actually judged* is what makes the sentence
 * true, and it is enforced upstream of this component.
 *
 * A model nobody has judged yet has no win rate. It shows an em dash, not 0% —
 * printing zero would claim it lost.
 */

type WinRateProps = {
  readonly won: number;
  readonly judged: number;
  readonly className?: string;
};

export const WinRate = ({ won, judged, className }: WinRateProps) => {
  const rate = winRate(won, judged);
  const record = formatWinRecord(won, judged);

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="img"
      aria-label={rate === null ? "not judged yet" : `${formatWinRate(rate)}, ${record}`}
    >
      <span
        className={cn(
          "measured text-title font-semibold tabular-nums",
          rate === null ? "text-ink-muted" : "text-rust",
        )}
        aria-hidden="true"
      >
        {formatWinRate(rate)}
      </span>

      <div className="min-w-0" aria-hidden="true">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-rust transition-[width] duration-300"
            style={{ width: `${(rate ?? 0) * 100}%` }}
          />
        </div>
        <p className="mt-1 eyebrow leading-none text-ink-muted">
          {judged === 0 ? EM_DASH : record}
        </p>
      </div>
    </div>
  );
};
