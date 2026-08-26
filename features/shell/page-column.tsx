/**
 * The measure every screen's content sits in.
 *
 * Extracted because it reached three callers — the empty arena, a live thread,
 * and the not-found page — which is the point `CLAUDE.md` says a repeated
 * handful of classes has stopped being a coincidence. It owns the width, the
 * gutters, and the fact that a screen grows to fill the space the shell gives
 * it, and nothing else: what goes inside is each screen's business.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageColumnProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const PageColumn = ({ children, className }: PageColumnProps) => (
  <div className={cn("mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 sm:px-4", className)}>
    {children}
  </div>
);
