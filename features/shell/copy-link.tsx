"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Hand this thread to someone else.
 *
 * **Shown to a visitor as well as the owner.** Sharing is not the owner's
 * exclusive act — a thread gets passed on by whoever is looking at it — and it
 * is a read of the address plus a write to the clipboard, so there is nothing
 * here to authorise.
 *
 * **The link is rebuilt, never read off the address bar.** A thread the owner
 * has just started is sitting on `?live=<turnId>`, which is a handoff between
 * two of our own screens and means nothing to anybody else. Copying the current
 * URL would share that; composing the canonical path shares the thread.
 *
 * **The confirmation is a popover, not a tooltip.** It carries the one thing
 * about this app's sharing model nobody can work out from the screen — that the
 * link is the only key — and a tooltip is exactly the wrong place for
 * information that matters, because it never appears on a touch device. It also
 * does not steal focus: `onOpenAutoFocus` is prevented, so the control you just
 * pressed is still the control you are on.
 *
 * **The live region is a separate, always-mounted element, and that is not
 * duplication.** The popover's content is unmounted while it is closed, so the
 * sentence inside it arrives as a live region that is already populated — which
 * several screen readers do not announce at all. A region that is present from
 * first render and then filled is the shape that actually gets read out. The
 * popover is what a sighted reader sees; this is what everyone else hears.
 *
 * Nothing auto-dismisses. A timer would decide how fast someone reads.
 */

type CopyState = "idle" | "copied" | "failed";

const MESSAGES: Readonly<Record<Exclude<CopyState, "idle">, string>> = {
  copied: "Link copied. Anyone with it can read this thread — only its owner can add to it.",
  failed: "Couldn’t copy the link. Copy it from the address bar instead.",
};

type CopyLinkProps = {
  readonly threadId: string;
};

export const CopyLink = ({ threadId }: CopyLinkProps) => {
  const [state, setState] = useState<CopyState>("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/thread/${threadId}`);
      setState("copied");
    } catch {
      // The clipboard is refusable — an insecure context, a denied permission —
      // and a person never sees the exception. They get the sentence and the
      // one thing that still works.
      setState("failed");
    }
  };

  const message = state === "idle" ? "" : MESSAGES[state];

  return (
    <>
      {/* Present from the first render, empty until there is something to say. */}
      <span role="status" className="sr-only">
        {message}
      </span>

      <Popover
        open={state !== "idle"}
        onOpenChange={(open) => {
          if (!open) setState("idle");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void copy();
            }}
          >
            <Link2 aria-hidden="true" />
            {/* The label is the control saying what it does. It hides on the
                narrowest bars, where the icon and its accessible name carry it. */}
            <span className="sr-only sm:not-sr-only">Copy link</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-72"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          {/* Not a live region: the one above is. */}
          <p className="text-detail text-ink">{message}</p>
        </PopoverContent>
      </Popover>
    </>
  );
};
