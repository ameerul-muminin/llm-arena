import type { Metadata } from "next";

import { StreamHarness } from "./stream-harness";

export const metadata: Metadata = {
  title: "Model stream check",
  robots: { index: false, follow: false },
};

export default function DevStreamPage() {
  return <StreamHarness />;
}
