import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk_reload_at";

/**
 * Lazy import that survives stale deployments.
 *
 * After a new build is published, old chunk filenames disappear from the CDN and
 * dynamic imports fail with "Failed to fetch dynamically imported module",
 * producing a blank screen. In that case we retry once, then force a single
 * hard reload so the browser picks up the fresh asset manifest.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      // Second chance: transient network hiccup.
      try {
        return await factory();
      } catch {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Never resolves; the page is reloading.
          return await new Promise<{ default: T }>(() => {});
        }
        throw error;
      }
    }
  });
}
