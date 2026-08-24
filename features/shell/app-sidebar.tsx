"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
 * client component and that is the last boundary that can query anything. A
 * signed-out visitor has no threads, which reads as an invitation rather than
 * as an error.
 */

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
};

export const AppSidebar = ({ threads }: AppSidebarProps) => {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  /* On a phone the sidebar is a drawer over the content, so following a link
     inside it has to close it — otherwise you navigate and stare at the menu. */
  const dismissOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar onClick={dismissOnMobile}>
      <SidebarHeader className="px-4 pt-4 pb-2">
        <Link href="/" className="rounded-md text-title font-semibold tracking-tight text-ink">
          LLM Arena
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const current = isCurrent(item, pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={current}>
                      {/*
                       * `aria-current` as well as the rust tint: the current page
                       * must not be signalled by colour alone.
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
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow text-ink-muted">Your threads</SidebarGroupLabel>
          <SidebarGroupContent>
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
                  Nothing here yet. Send a prompt and this fills up.
                </p>
              )}
            </SidebarMenu>
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
