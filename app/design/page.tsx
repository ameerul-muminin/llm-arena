import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FixtureTurn } from "@/features/arena/fixture-turn";
import { ThemeToggle } from "@/features/design/theme";
import { WinRate } from "@/features/design/win-rate";
import { FIXTURE_STANDINGS } from "@/features/shell/fixtures";
import { ThreadStandings } from "@/features/shell/standings";
import { ContrastTable } from "./contrast-table";

/**
 * The design system, on one page, in whichever theme is live.
 *
 * This exists because the project has deliberately no test runner and no browser
 * automation: the way anything gets verified here is a running dev server and a
 * real browser. That is only workable if there is one place showing every token,
 * every state, and every measured contrast pair at once — otherwise checking a
 * palette change means hunting states across screens that do not exist yet.
 *
 * It is meant to outlive feature 4. Any token edit is checked here first.
 */

export const metadata: Metadata = {
  title: "Design reference — LLM Arena",
  description: "Every token, component, and state in this app's design system.",
};

type SectionProps = {
  readonly title: string;
  readonly summary: string;
  readonly children: ReactNode;
};

const Section = ({ title, summary, children }: SectionProps) => (
  <section className="border-t border-line pt-10">
    <h2 className="text-title font-medium text-ink">{title}</h2>
    <p className="mt-1 max-w-2xl text-detail text-ink-muted">{summary}</p>
    <div className="mt-6">{children}</div>
  </section>
);

const SWATCH_GROUPS: readonly {
  readonly name: string;
  readonly tokens: readonly string[];
}[] = [
  {
    name: "Ground",
    tokens: ["--ground", "--surface", "--surface-raised", "--line", "--line-strong"],
  },
  { name: "Ink", tokens: ["--ink", "--ink-muted"] },
  { name: "Accent", tokens: ["--rust", "--rust-hover", "--rust-ink"] },
  { name: "Reserved", tokens: ["--win", "--fail"] },
  { name: "Time axis", tokens: ["--axis-track", "--axis-fill", "--axis-mark"] },
];

const Swatch = ({ token }: { readonly token: string }) => (
  <div className="flex items-center gap-2">
    <span
      className="size-7 shrink-0 rounded-md border border-line-strong"
      style={{ backgroundColor: `var(${token})` }}
      aria-hidden="true"
    />
    <code className="measured text-micro text-ink-muted">{token}</code>
  </div>
);

export default function DesignReferencePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="flex items-start justify-between gap-6 pb-10">
        <div>
          <p className="eyebrow text-ink-muted">LLM Arena</p>
          <h1 className="mt-2 text-display font-semibold tracking-tight text-ink">
            Design reference
          </h1>
          <p className="mt-2 max-w-2xl text-body text-ink-muted">
            A warm-lit measuring bench, not a chat app. Three identical instruments run the same
            sample side by side, and every number on screen was actually measured.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="space-y-10">
        <Section
          title="The arena"
          summary="Three answers, one shared time scale. The track under each card is drawn against the turn's slowest finisher, so the cards are a race chart drawn in place."
        >
          <FixtureTurn />
        </Section>

        <Section
          title="What the axis refuses to say"
          summary="Line weight carries the meaning. One pixel is time passing with nothing to show for it, a three-pixel band is text genuinely arriving, and a tall solid mark is an answer that landed in one flush and therefore has no generation speed to report."
        >
          <ul className="grid gap-2 text-detail text-ink-muted sm:grid-cols-2">
            <li>
              A buffering model gets a mark, never a band. There is no window to draw a band across,
              and inventing one would be the same lie as inventing the speed.
            </li>
            <li>
              A failed call&rsquo;s line stops where the call stopped. No invented endpoint, and the
              card stays in the grid rather than vanishing mid-turn.
            </li>
          </ul>
        </Section>

        <Section
          title="Type, and the rule about it"
          summary="Instrument Sans carries anything written for a person. IBM Plex Mono carries measured facts and identifiers, and nothing else — so a reader learns without being told that the mono text is the part that came off the wire."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
              <p className="eyebrow text-ink-muted">Prose, never mono</p>
              <p className="text-display font-semibold tracking-tight text-ink">Display, 28px</p>
              <p className="text-title font-medium text-ink">Title, 20px</p>
              <p className="text-body text-ink">
                Body, 15px. Send one prompt, watch three models answer it at the same time, and vote
                for the one that actually helped.
              </p>
              <p className="text-detail text-ink-muted">Detail, 13px, for secondary copy.</p>
            </div>

            <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
              <p className="eyebrow text-ink-muted">Measured, always mono</p>
              <p className="measured text-display font-semibold text-rust">71%</p>
              <p className="measured text-body text-ink">412ms · 178 tok/s · 240 written</p>
              <p className="measured text-body text-ink">google/gemma-4-31b-it:free</p>
              <p className="measured text-body text-ink-muted">— · $0.0000 · won 4 of 5</p>
              <p className="text-detail text-ink-muted">
                The em dash is a number we do not have. It is never a zero.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Colour"
          summary="Coffee ground, rust accent, and two colours held in reserve. Rust marks what you interact with plus the win-rate bar. Green means a winner and nothing else; red means an error and nothing else."
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SWATCH_GROUPS.map((group) => (
              <div key={group.name} className="space-y-3">
                <p className="eyebrow text-ink-muted">{group.name}</p>
                <div className="space-y-2">
                  {group.tokens.map((token) => (
                    <Swatch key={token} token={token} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Records"
          summary="A rate never appears without the count it came from. A model nobody has judged yet shows an em dash, not zero — printing zero would claim it lost. The standings cluster is the top bar's; narrow the window and watch it drop the names, then collapse to one control."
        >
          <div className="space-y-6">
            <ThreadStandings standings={FIXTURE_STANDINGS} />

            <div className="grid gap-6 rounded-xl border border-line bg-surface p-5 sm:grid-cols-3">
              <WinRate won={507} judged={700} />
              <WinRate won={1} judged={2} />
              <WinRate won={0} judged={0} />
            </div>
          </div>
        </Section>

        <Section
          title="Controls"
          summary="Tab through these. Every one takes a visible rust focus ring with a ground-coloured offset, so it reads whether the control sits on the page or on a raised card."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Send prompt</Button>
            <Button variant="outline">Add model</Button>
            <Button variant="secondary">Personal</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="outline" size="xs">
              Try again
            </Button>
            <Button variant="link">A link, in rust</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section
          title="Contrast, measured"
          summary="Read from the tokens as the browser resolved them, in the theme that is live right now. Switch the theme with the control at the top of the page and these recompute."
        >
          <ContrastTable />
        </Section>
      </div>
    </main>
  );
}
