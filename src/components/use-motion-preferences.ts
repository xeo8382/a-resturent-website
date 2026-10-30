"use client";
import { useCallback, useSyncExternalStore } from "react";

// A stable server snapshot keeps SSR and the first hydration render identical.
// Reduced-motion CSS handles the first paint; the subscription handles live changes.
const serverSnapshot = () => false;
function useMediaPreference(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    [query],
  );
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
export const useReducedMotionPreference = () =>
  useMediaPreference("(prefers-reduced-motion: reduce)");
export const useCompactMotion = () =>
  useMediaPreference("(max-width: 760px), (pointer: coarse)");
