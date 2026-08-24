"use client";

import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { isCurrent, NAV_ITEMS } from "./nav";

/**
 * The bar that stays put while the answers scroll under it.
 *
 * It works out where you are from the path rather than being told by each page.
 * A page that has to remember to declare its own title is a page that will one
 * day forget, and the nav already declares the names once.
 *
 * Standings only appear where there is a thread to have standings in. On the
 * leaderboard or the models list they would be a record of something you are
 * not looking at — so the bar does not go looking for them. They arrive as a
 * slot, rendered by whichever route is open below, which is the only way this
 * component can show a fact about a segment nested inside it without being
 * told by the client after the fact.
 */

const SidebarToggle = () => {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
  const shown = isMobile ? openMobile : open;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      /*
       * The vendored `SidebarTrigger` hardcodes "Toggle Sidebar" and reports no
       * state. A control should say what it does and, if it toggles something,
       * say which way it currently is.
       */
      aria-expanded={shown}
      aria-label={shown ? "Hide the sidebar" : "Show the sidebar"}
    >
      <PanelLeft aria-hidden="true" />
    </Button>
  );
};

type TopBarProps = {
  /** Whatever the open route wants in the bar. Empty on most of them. */
  readonly thread: ReactNode;
};

export const TopBar = ({ thread }: TopBarProps) => {
  const pathname = usePathname();
  const section = NAV_ITEMS.find((item) => isCurrent(item, pathname));

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ground/85 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <SidebarToggle />

        <nav aria-label="Breadcrumb" className="shrink-0">
          <ol className="flex items-center gap-2">
            <li className="text-detail text-ink-muted">{section?.label ?? "Arena"}</li>
          </ol>
        </nav>

        <div className="flex min-w-0 flex-1 items-center gap-2">{thread}</div>
      </div>
    </header>
  );
};
