import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Enables `forbidden()`, which feature 10's public reads throw when Arcjet
   * denies them. Narrow: it turns on the two auth interrupts and their
   * boundaries and changes nothing else. It is worth a flag because the
   * alternative was rendering a refusal at `200`, and this app does not put a
   * status on a response that contradicts what happened.
   */
  experimental: { authInterrupts: true },
  // Next's own type declares `rewrites` as returning a promise, so this is async
  // by requirement rather than because there is anything here to await.
  // eslint-disable-next-line @typescript-eslint/require-await
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
