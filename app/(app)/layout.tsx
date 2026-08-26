import { auth } from "@clerk/nextjs/server";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { SkipLink } from "@/features/shell/skip-link";
import { TopBar } from "@/features/shell/top-bar";
import { listThreadsForOwner } from "@/features/thread/queries";

/**
 * The frame every screen of the product sits inside.
 *
 * It is a route group rather than a component each page remembers to wrap itself
 * in, so a new screen cannot be added un-framed. `/design` deliberately stays
 * outside it: that page is a reference instrument for the palette, not a screen
 * of the product, and dressing it in the app chrome would make it lie about what
 * it is.
 *
 * `SidebarInset` is not used, even though it is the obvious partner to
 * `SidebarProvider`, because it renders a `<main>`. This layout already has one,
 * and the top bar belongs outside it — a second `main` would leave the page with
 * two of a landmark that is only allowed one, and put the banner inside the
 * content it labels.
 *
 * The thread list is read here rather than in the sidebar, because the sidebar
 * is a client component and this is the last server boundary above it. A signed
 * out visitor has no threads to list, which is a real state and not an error —
 * and a different one from a signed-in person who has not run a thread yet, so
 * the answer is passed down rather than inferred from the empty array.
 */

/** How many threads the sidebar shows before it stops being a list you can scan. */
const SIDEBAR_THREADS = 25;

export default async function AppLayout({ children, thread }: LayoutProps<"/">) {
  const { userId } = await auth();
  const threads = userId === null ? [] : await listThreadsForOwner(userId, SIDEBAR_THREADS);

  return (
    <SidebarProvider className="flex-1">
      <SkipLink />
      <AppSidebar threads={threads} signedIn={userId !== null} />

      <div className="relative flex w-full min-w-0 flex-1 flex-col bg-background">
        <TopBar thread={thread} />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
