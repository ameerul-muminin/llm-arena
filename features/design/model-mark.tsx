import { cn } from "@/lib/utils";
import { modelInitial } from "./format";

/**
 * A model's stand-in: a circled initial, and next to it — in the top bar — its
 * record in this thread.
 *
 * Deliberately monochrome. Scope's "not doing right now" list already parks
 * giving each model a distinct look, and colouring these would fight the
 * one-accent rule directly: rust means interactive, green means winner, red
 * means error, and a fourth meaning would empty all three.
 */

type ModelMarkProps = {
  readonly modelId: string;
  readonly className?: string;
};

export const ModelMark = ({ modelId, className }: ModelMarkProps) => (
  <span
    className={cn(
      "inline-flex size-6 shrink-0 border-line-strong measured text-micro text-ink-muted",
      "items-center justify-center rounded-full border",
      className,
    )}
    aria-hidden="true"
  >
    {modelInitial(modelId)}
  </span>
);
