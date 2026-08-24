"use client";

import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { FIXTURE_STANDINGS, FIXTURE_THREAD_TITLE } from "./fixtures";
import { isCurrent, NAV_ITEMS } from "./nav";
import { ThreadStandings } from "./standings";

/**
 * The bar that stays put while the answers scroll under it.
 *
 * It works out where you are from the path rather than being told by each page.
 * A page that has to remember to declare its own title is a page that will one
 * day forget, and the nav already declares the names once.
 *
 * Standings only appear where there is a thread to have standings in. On the
 * leaderboard or the models list they would be a record of something you are
 * not looking at.
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

export const TopBar = () => {
  const pathname = usePathname();
  const section = NAV_ITEMS.find((item) => isCurrent(item, pathname));
  const onThread = pathname === "/" || pathname.startsWith("/thread/");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ground/85 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <SidebarToggle />

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-2">
            <li className="shrink-0 text-detail text-ink-muted">{section?.label ?? "Arena"}</li>
            {onThread && (
              <>
                <li aria-hidden="true" className="shrink-0 text-ink-muted">
                  /
                </li>
                <li className="min-w-0 truncate text-detail font-medium text-ink">
                  {FIXTURE_THREAD_TITLE}
                </li>
              </>
            )}
          </ol>
        </nav>

        {onThread && <ThreadStandings standings={FIXTURE_STANDINGS} />}
      </div>
    </header>
  );
};
