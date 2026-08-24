import type { ModelMetrics } from "@/features/model-call/types";
import { cn } from "@/lib/utils";
import { FREE_TIER_COST, formatMs, formatTokens, formatTokensPerSecond, EM_DASH } from "./format";

/**
 * The bench readout under an answer. Every value here was measured; none of it
 * is derived a second time, it only renders what `ModelMetrics` already says.
 *
 * Passing `null` — while a call is still in flight — is a supported state, not a
 * degraded one: every slot shows an em dash, because at that moment we honestly
 * do not have the number yet.
 *
 * There are two speed figures on purpose, and they are labelled as the different
 * things they are. "Generation" is text over the window it streamed in, and is
 * blank for a model that flushed everything at once, because that has no
 * observable generation speed. "Overall" divides everything produced, thinking
 * included, by the whole wait, which is the only speed that compares fairly
 * across a streaming model and a buffering one.
 */

type MetricProps = {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
};

const Metric = ({ label, value, className }: MetricProps) => (
  <div className={cn("min-w-0", className)}>
    <dt className="eyebrow text-ink-muted">{label}</dt>
    <dd
      className={cn(
        "mt-0.5 truncate measured text-detail",
        value === EM_DASH ? "text-ink-muted" : "text-ink",
      )}
    >
      {value}
    </dd>
  </div>
);

type MetricsRowProps = {
  readonly metrics: ModelMetrics | null;
  readonly className?: string;
};

export const MetricsRow = ({ metrics, className }: MetricsRowProps) => (
  <dl className={cn("grid grid-cols-3 gap-x-4 gap-y-3", className)}>
    <Metric label="To first token" value={formatMs(metrics?.timeToFirstTokenMs ?? null)} />
    <Metric label="Generation" value={formatTokensPerSecond(metrics?.tokensPerSecond ?? null)} />
    <Metric
      label="Overall"
      value={formatTokensPerSecond(metrics?.endToEndTokensPerSecond ?? null)}
    />
    <Metric label="Written" value={formatTokens(metrics?.textTokens ?? null)} />
    {/*
     * Only shown when the provider reported it at all. A reasoning model can
     * spend hundreds of tokens before writing a word, and hiding that behind a
     * single output figure makes a three-sentence answer look absurdly verbose.
     * A model that reports nothing here gets no column rather than a zero.
     */}
    {metrics?.reasoningTokens != null && (
      <Metric label="Thinking" value={formatTokens(metrics.reasoningTokens)} />
    )}
    <Metric label="Cost" value={FREE_TIER_COST} />
  </dl>
);
