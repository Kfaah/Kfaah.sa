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
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (error) {
      // Second chance: transient network hiccup.
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          // Cache-bust so the browser re-fetches a fresh asset manifest.
          const url = new URL(window.location.href);
          url.searchParams.set("v", Date.now().toString(36));
          window.location.replace(url.toString());
          // Never resolves; the page is reloading.
          return await new Promise<{ default: T }>(() => {});
        }
        throw error;
      }
    }
  });
}

