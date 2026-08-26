"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Catalogue } from "@/features/catalogue/types";
import { PageColumn } from "@/features/shell/page-column";

import { startTurn } from "./actions";
import { Composer } from "./composer";

/**
 * The empty arena: where a thread is born.
 *
 * **It creates the thread, then navigates, and the answers stream on the other
 * side.** Streaming here first and rewriting the address afterwards was the
 * plan, and it does not survive contact with the rest of the app: a shallow URL
 * change is invisible to the server, so the top bar's standings, the sidebar's
 * thread list and the page's own data would all still be describing a thread
 * that does not exist. Navigating first costs one server round trip before the
 * first token, which is measured on the far side of it anyway and so never
 * lands in anyone's metrics.
 *
 * The new turn's id rides along in the URL because it is the one thing the
 * next screen cannot work out for itself: a turn with no answers looks exactly
 * like a turn whose answers were refused, and only one of those should be sent
 * to three models.
 */

type NewThreadProps = {
  readonly catalogue: Catalogue;
};

export const NewThread = ({ catalogue }: NewThreadProps) => {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (prompt: string, modelIds: readonly string[]): Promise<boolean> => {
    setSending(true);
    setError(null);

    const result = await startTurn({ threadId: null, prompt, modelIds });

    if (!result.ok) {
      setSending(false);
      setError(result.message);
      return false;
    }

    // Deliberately still `sending` — the navigation is the rest of this action,
    // and re-enabling the control mid-flight would invite a second thread.
    router.replace(`/thread/${result.threadId}?live=${result.turnId}`);
    return true;
  };

  return (
    <PageColumn>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <h1 className="text-title text-ink">Ask three models at once</h1>
        <p className="max-w-md text-body text-ink-muted">
          One prompt, answered side by side, with real time-to-first-token and tokens per second
          under every answer. Pick the one that actually won.
        </p>
      </div>

      <div className="sticky bottom-0 bg-ground/85 pt-2 pb-4 backdrop-blur-sm">
        <Composer
          catalogue={catalogue}
          lineUp={null}
          onSend={send}
          sending={sending}
          error={error}
        />
      </div>
    </PageColumn>
  );
};
