import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { ThemeProvider } from "@/features/design/theme";
import "./globals.css";

/**
 * Two faces, and a rule about which.
 *
 * Instrument Sans carries everything written for a person to read. IBM Plex Mono
 * carries measured facts and identifiers, and nothing else — every metric, every
 * token count, every model id, every "won 4 of 5", every em dash standing in for
 * a number we refuse to invent. Prose is never mono; a measurement never goes
 * without it.
 *
 * That is a structural rule, not a stylistic one: it means a reader learns
 * without being told that the mono text is the part that came off the wire.
 */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LLM Arena",
  description:
    "Send one prompt to three models at once, watch them answer, and vote for the best. Real votes and real per-call numbers, not vibes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * `suppressHydrationWarning` is required by next-themes and is scoped to this
     * one element: the theme class is written by a script before React hydrates,
     * so the server's `<html>` genuinely cannot match the client's.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* Clerk's provider belongs inside `body`, not around `html`. */}
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <ClerkProvider>{children}</ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
