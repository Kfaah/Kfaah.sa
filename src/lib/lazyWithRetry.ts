import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk_reload_at";

type Mod<T> = { default: T };

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable (sandboxed iframe / private mode) */
  }
}

function safeRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Normalize a dynamic import result so React.lazy always receives an object
 * with a valid `default`. A stale or partially evaluated chunk can resolve to
 * `undefined` or to a namespace without `default`, which makes React throw
 * "Cannot read properties of undefined (reading 'default')" and blank the page.
 */
function normalize<T extends ComponentType<any>>(mod: any): Mod<T> {
  if (mod && typeof mod === "object") {
    if (mod.default) return mod as Mod<T>;
    // Fall back to the single exported component, if any.
    const candidate = Object.values(mod).find(
      (v) => typeof v === "function" || (v && typeof v === "object" && "render" in (v as any)),
    );
    if (candidate) return { default: candidate as T };
  }
  throw new Error("Invalid module: missing default export");
}

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
  return lazy<T>(async () => {
    try {
      const mod = normalize<T>(await factory());
      safeRemove(RELOAD_KEY);
      return mod;
    } catch (error) {
      // Second chance: transient network hiccup or partially loaded chunk.
      try {
        const mod = normalize<T>(await factory());
        safeRemove(RELOAD_KEY);
        return mod;
      } catch {
        const last = Number(safeGet(RELOAD_KEY) || 0);
        if (Date.now() - last > 10000) {
          safeSet(RELOAD_KEY, String(Date.now()));
          // Cache-bust so the browser re-fetches a fresh asset manifest.
          const url = new URL(window.location.href);
          url.searchParams.set("v", Date.now().toString(36));
          window.location.replace(url.toString());
          // Never resolves; the page is reloading.
          return await new Promise<Mod<T>>(() => {});
        }
        throw error;
      }
    }
  });
}


