"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { ModelMark } from "@/features/design/model-mark";
import { ThemeToggle } from "@/features/design/theme";
import type { ThreadListRow } from "@/features/thread/types";
import { isCurrent, NAV_ITEMS } from "./nav";

/**
 * The sidebar: where you are, and what you have already asked.
 *
 * A thread row carries the models that were in it and how many turns it ran,
 * because that is what actually makes one findable again — you remember "the one
 * where I put Gemma against Qwen" far better than you remember what you titled
 * it. Both facts are true of the content rather than decoration on top of it.
 *
 * There is no date grouping. "Today / Previous 7 days / Older" earns its place
 * in a product where you scroll hundreds of conversations; here it would be
 * three headings over four rows.
 *
 * The list is read on the server, in the layout above this, because this is a
 * client component and that is the last boundary that can query anything.
 *
 * **An empty list is two different facts and says two different things.** A
 * signed-in person with no threads is being invited to send a prompt. Someone
 * who has just opened a shared link cannot send one yet, so telling them to
 * would be describing an action they do not have. Both used to read
 * "Send a prompt and this fills up", which was right for one of them.
 *
 * `signedIn` is a prop rather than Clerk's `<Show>`, which the footer below uses
 * for its own controls. The layout already resolved this on the server to decide
 * whether to query at all, so passing the answer down renders the right sentence
 * in the first paint instead of the wrong one until Clerk hydrates.
 */

/** Ties the thread-history landmark to the heading a sighted reader already sees. */
const THREADS_LABEL = "sidebar-threads-label";

const ThreadRowLink = ({
  thread,
  active,
}: {
  readonly thread: ThreadListRow;
  readonly active: boolean;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={active} className="h-auto items-start py-2">
      <Link href={`/thread/${thread.id}`} aria-current={active ? "page" : undefined}>
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <span className="truncate text-detail">{thread.title}</span>
          <span className="flex items-center gap-1">
            {thread.modelIds.map((modelId) => (
              <ModelMark key={modelId} modelId={modelId} className="size-4 text-[9px]" />
            ))}
            <span className="ml-auto measured text-micro text-ink-muted">
              {thread.turnCount} {thread.turnCount === 1 ? "turn" : "turns"}
            </span>
          </span>
        </div>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

type AppSidebarProps = {
  readonly threads: readonly ThreadListRow[];
  /** Whether anyone is signed in, which decides what an empty list means. */
  readonly signedIn: boolean;
};

export const AppSidebar = ({ threads, signedIn }: AppSidebarProps) => {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  /*
   * On a phone the sidebar is a drawer over the content, so following a link
   * inside it has to close it — otherwise you navigate and stare at the menu.
   *
   * This cannot go on `<Sidebar>`, which is where it started out. On mobile that
   * component spreads its props onto Radix's `Dialog.Root`, which reads only its
   * own handful of props and renders a context provider rather than an element,
   * so an `onClick` there is dropped without a word — on exactly the path it was
   * written for. It goes on the two real elements that contain the links.
   *
   * It fires only for a click that landed on a link, so tapping a group label or
   * the empty space beside one does not pull the drawer shut underneath you.
   */
  const dismissOnMobile = (event: MouseEvent<HTMLElement>) => {
    if (!isMobile) return;
    if (event.target instanceof Element && event.target.closest("a") !== null) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar
      drawerTitle="Navigation"
      drawerDescription="The sections of the app, and the threads you have already run."
    >
      <SidebarHeader className="px-4 pt-4 pb-2" onClick={dismissOnMobile}>
        <Link href="/" className="rounded-md text-title font-semibold tracking-tight text-ink">
          LLM Arena
        </Link>
      </SidebarHeader>

      {/*
       * Two `nav` landmarks, because shadcn's sidebar is divs the whole way down
       * and would otherwise leave every link in the app outside a landmark —
       * with the breadcrumb in the top bar as the only one on the page, which is
       * exactly backwards. They are separate rather than one, because "the three
       * places this app goes" and "the threads you have run" are different kinds
       * of navigation, and a screen reader offering them as two named choices is
       * more use than one unlabelled list of everything.
       */}
      <SidebarContent onClick={dismissOnMobile}>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Sections">
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const current = isCurrent(item, pathname);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={current}>
                        {/*
                         * `aria-current` as well as the rust tint: the current
                         * page must not be signalled by colour alone.
                         */}
                        <Link href={item.href} aria-current={current ? "page" : undefined}>
                          <item.icon />
                          <span className={current ? "font-medium text-rust" : undefined}>
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          {/* Labelled by the heading already on screen, rather than repeating the
              same two words in an `aria-label` only some people ever get. */}
          <SidebarGroupLabel id={THREADS_LABEL} className="eyebrow text-ink-muted">
            Your threads
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-labelledby={THREADS_LABEL}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/">
                      <Plus />
                      <span>New thread</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {threads.map((thread) => (
                  <ThreadRowLink
                    key={thread.id}
                    thread={thread}
                    active={pathname === `/thread/${thread.id}`}
                  />
                ))}

                {threads.length === 0 && (
                  <p className="px-2 py-1.5 text-detail text-ink-muted">
                    {signedIn
                      ? "Nothing here yet. Send a prompt and this fills up."
                      : "Sign in and the threads you run show up here."}
                  </p>
                )}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex-row items-center justify-between px-4 py-3">
        <Show when="signed-in">
          <UserButton />
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </SignInButton>
        </Show>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
};
