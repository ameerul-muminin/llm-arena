"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this person has asked for less movement.
 *
 * A media query is genuinely an external system — the browser owns the value
 * and tells us when it changes — so it is subscribed to rather than mirrored
 * into state from an effect. That is the same correction features 4 and 7
 * already made twice, and it also means the first client render is already
 * right instead of being right one render later.
 *
 * The server has no idea, so it renders as though motion were fine and the
 * first client paint corrects it. Guessing the other way would freeze the axis
 * for everyone on their first paint.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
};

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
