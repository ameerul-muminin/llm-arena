import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The one marker for anything not yet wired to real data.
 *
 * Fixture data that looks real is worse than no data, because it quietly becomes
 * the thing people evaluate. Every unwired surface wears this, so the signal is
 * consistent, greppable, and removed feature by feature rather than hunted for.
 *
 * It is deliberately drawn with a dashed hairline and nothing else. Red is
 * reserved for errors and rust for things you interact with — a placeholder is
 * neither, and borrowing either colour would empty it of meaning elsewhere.
 *
 * The copy is written from the reader's side: what this will do once it is real,
 * not which feature number owns it.
 */
export const PlaceholderNote = ({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) => (
  <div
    className={cn(
      "rounded-xl border border-dashed border-line-strong bg-surface-raised/40 px-4 py-3",
      className,
    )}
  >
    <p className="eyebrow text-ink-muted">Placeholder</p>
    <p className="mt-1 text-detail text-ink-muted">{children}</p>
  </div>
);
