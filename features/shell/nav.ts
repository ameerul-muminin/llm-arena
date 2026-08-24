import { LayoutGrid, ListOrdered, Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The three places this app goes. Declared once so the sidebar and any
 * breadcrumb agree on names and order by construction rather than by two people
 * typing the same strings.
 */
export type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Arena", icon: LayoutGrid },
  { href: "/leaderboard", label: "Leaderboard", icon: ListOrdered },
  { href: "/models", label: "Models", icon: Boxes },
];

/**
 * Which nav item a path belongs to. `/` has to match exactly or it would claim
 * every route in the app as its own.
 */
export const isCurrent = (item: NavItem, pathname: string): boolean =>
  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
