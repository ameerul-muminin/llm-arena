"use client";

import { useTheme } from "next-themes";
import { useMemo, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * Contrast, measured in the browser rather than claimed in a comment.
 *
 * The brief asks for contrast that genuinely holds up in both modes, "not just
 * look fine at a glance". Hand-computing ratios while choosing a palette already
 * caught one real failure — the first rust was under 4.5:1 in both directions —
 * but a number written down once goes stale the moment a token is edited. This
 * reads the tokens as the browser actually resolved them, in whichever theme is
 * live, and recomputes.
 *
 * Lives beside the page rather than in `features/design/` on purpose: it is a
 * verification instrument for this project's own palette, not part of the design
 * system that ships inside the app.
 */

type Pair = {
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  /**
   * 4.5 for body text and 3 for controls and meaningful graphics, per WCAG AA.
   *
   * `null` means genuinely decorative, and it is not a loophole — it is listed
   * and measured all the same, just without a threshold it was never required to
   * meet. The hairline between a card and the page is the case: the card is
   * already delineated by its own background, so the line is not carrying the
   * boundary alone. The moment a line *is* the boundary of a control it stops
   * being decorative and takes the 3:1, which is why `--line-strong` is here
   * with a number next to it.
   */
  readonly required: 3 | 4.5 | null;
};

const PAIRS: readonly Pair[] = [
  { label: "Body text on page", foreground: "--ink", background: "--ground", required: 4.5 },
  { label: "Body text on card", foreground: "--ink", background: "--surface", required: 4.5 },
  { label: "Muted text on page", foreground: "--ink-muted", background: "--ground", required: 4.5 },
  {
    label: "Muted text on card",
    foreground: "--ink-muted",
    background: "--surface",
    required: 4.5,
  },
  {
    label: "Muted text on raised",
    foreground: "--ink-muted",
    background: "--surface-raised",
    required: 4.5,
  },
  { label: "Link / accent on page", foreground: "--rust", background: "--ground", required: 4.5 },
  { label: "Link / accent on card", foreground: "--rust", background: "--surface", required: 4.5 },
  { label: "Button label on rust", foreground: "--rust-ink", background: "--rust", required: 4.5 },
  { label: "Winner green on card", foreground: "--win", background: "--surface", required: 4.5 },
  { label: "Error red on card", foreground: "--fail", background: "--surface", required: 4.5 },
  { label: "Focus ring on page", foreground: "--rust", background: "--ground", required: 3 },
  { label: "Time axis on card", foreground: "--axis-fill", background: "--surface", required: 3 },
  {
    label: "Control boundary on page",
    foreground: "--line-strong",
    background: "--ground",
    required: 3,
  },
  {
    label: "Control boundary on card",
    foreground: "--line-strong",
    background: "--surface",
    required: 3,
  },
  {
    label: "Hairline on page (decorative)",
    foreground: "--line",
    background: "--ground",
    required: null,
  },
];

type Rgb = readonly [number, number, number];

const parseHex = (value: string): Rgb | null => {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const n = Number.parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const channel = (value: number): number => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrastRatio = (a: Rgb, b: Rgb): number => {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

type Measured = Pair & { readonly ratio: number | null };

const measure = (root: HTMLElement, pair: Pair): Measured => {
  const styles = getComputedStyle(root);
  const fg = parseHex(styles.getPropertyValue(pair.foreground));
  const bg = parseHex(styles.getPropertyValue(pair.background));
  return { ...pair, ratio: fg && bg ? contrastRatio(fg, bg) : null };
};

/**
 * The theme, read as the DOM actually has it rather than as React believes it.
 *
 * `useSyncExternalStore` is the right shape here and an effect is not: the class
 * on `<html>` is genuinely an external system — next-themes writes it from an
 * inline script before React ever hydrates — so this subscribes to it and reads
 * a snapshot. The snapshot is the class string, which is referentially stable,
 * because returning a freshly-computed array from `getSnapshot` would spin React
 * forever.
 */
const subscribeToThemeClass = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    observer.disconnect();
  };
};

const themeClassSnapshot = (): string => document.documentElement.className;

/** No DOM on the server, so nothing is measured and the table says so. */
const themeClassServerSnapshot = (): string => "";

export const ContrastTable = () => {
  const { resolvedTheme } = useTheme();
  const themeClass = useSyncExternalStore(
    subscribeToThemeClass,
    themeClassSnapshot,
    themeClassServerSnapshot,
  );

  const rows = useMemo<readonly Measured[]>(
    () => (themeClass === "" ? [] : PAIRS.map((pair) => measure(document.documentElement, pair))),
    [themeClass],
  );

  const judged = rows.filter((row) => row.required !== null);
  const failing = judged.filter(
    (row) => row.ratio !== null && row.required !== null && row.ratio < row.required,
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left">
        <caption className="sr-only">
          Measured contrast ratios for the current theme, against WCAG AA
        </caption>
        <thead>
          <tr className="border-b border-line bg-surface-raised">
            <th scope="col" className="px-4 py-2 eyebrow font-normal text-ink-muted">
              Pair
            </th>
            <th scope="col" className="px-4 py-2 text-right eyebrow font-normal text-ink-muted">
              Measured
            </th>
            <th scope="col" className="px-4 py-2 text-right eyebrow font-normal text-ink-muted">
              Needs
            </th>
            <th scope="col" className="px-4 py-2 text-right eyebrow font-normal text-ink-muted">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const passes = row.ratio !== null && row.required !== null && row.ratio >= row.required;
            return (
              <tr key={row.label} className="border-b border-line/60 last:border-b-0">
                <td className="px-4 py-2 text-detail text-ink">{row.label}</td>
                <td className="px-4 py-2 text-right measured text-detail text-ink">
                  {row.ratio === null ? "—" : `${row.ratio.toFixed(2)}:1`}
                </td>
                <td className="px-4 py-2 text-right measured text-detail text-ink-muted">
                  {row.required === null ? "—" : `${row.required.toFixed(1)}:1`}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right text-detail font-medium",
                    row.required === null ? "text-ink-muted" : passes ? "text-win" : "text-fail",
                  )}
                >
                  {row.required === null ? "Decorative" : passes ? "Pass" : "Fail"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t border-line bg-surface-raised px-4 py-2 text-detail text-ink-muted">
        {rows.length === 0
          ? "Measuring…"
          : failing === 0
            ? `All ${judged.length} thresholded pairs pass in the ${resolvedTheme ?? "current"} theme.`
            : `${failing} of ${judged.length} thresholded pairs fail in the ${resolvedTheme ?? "current"} theme.`}
      </p>
    </div>
  );
};
