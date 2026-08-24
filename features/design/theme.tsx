"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Theme, class-based rather than by media query.
 *
 * The sketch puts a theme toggle in the sidebar, and `prefers-color-scheme`
 * alone cannot honour a choice a person makes — it only reports what their OS
 * says. So the `dark` class on `<html>` is the switch, and the media query is
 * demoted to what it should be: the default for someone who has not chosen yet.
 *
 * Both modes are designed, not derived. Light is a warm parchment ground, not
 * the dark palette inverted, which would land on exactly the neutral grey the
 * brief rules out.
 */
export const ThemeProvider = ({ children }: { readonly children: ReactNode }) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    {children}
  </NextThemesProvider>
);

/**
 * The toggle itself.
 *
 * Which icon to show is decided in CSS, not in React. The obvious version keeps
 * a `mounted` flag in state and flips it in an effect, because the server cannot
 * know which theme the browser resolved — but that is a `setState` in an effect
 * body purely to learn "am I hydrated yet", and React 19's own lint rule flags
 * it as the cascading render it is.
 *
 * Letting the `dark` class do the work removes the problem rather than silencing
 * it: both icons and both labels are rendered, and the theme picks one. No
 * hydration mismatch, no placeholder, no flash of the wrong icon, and the button
 * is real markup on the very first paint.
 *
 * The accessible name is duplicated the same way, so a screen reader is told
 * which theme the control switches *to* rather than a vague "toggle theme".
 */
export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      <Sun className="dark:hidden" aria-hidden="true" />
      <Moon className="hidden dark:block" aria-hidden="true" />
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:block">Switch to light theme</span>
    </Button>
  );
};
