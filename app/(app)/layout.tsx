import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { SkipLink } from "@/features/shell/skip-link";
import { TopBar } from "@/features/shell/top-bar";

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
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider className="flex-1">
      <SkipLink />
      <AppSidebar />

      <div className="relative flex w-full min-w-0 flex-1 flex-col bg-background">
        <TopBar />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
