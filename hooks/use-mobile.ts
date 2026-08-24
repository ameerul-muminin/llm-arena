import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Vendored from shadcn, rewritten onto `useSyncExternalStore`.
 *
 * The original kept the answer in state and seeded it from an effect, purely to
 * learn something the browser already knows — which React 19's own
 * `set-state-in-effect` rule flags as the cascading render it is, and which also
 * made the first client render claim "not mobile" before correcting itself.
 *
 * A media query is the textbook external store: subscribe to it, read a
 * snapshot. The server snapshot is `false` because there is no viewport to
 * measure and the desktop layout is the right thing to send.
 */
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
};

const getSnapshot = () => window.matchMedia(QUERY).matches;

const getServerSnapshot = () => false;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
