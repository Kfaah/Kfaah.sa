import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const FALLBACK_BRANDING = {
  primary: "#2f8e8c",
  secondary: "#eef7f7",
  accent: "#2563eb",
};

const BRANDING_CACHE_PREFIX = "org_branding_v1:";
const BRANDING_SLUG_CACHE_PREFIX = "org_branding_slug_v1:";

interface CachedBranding {
  logoUrl: string | null;
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  /** Version key — usually organization_profiles.updated_at. Used to
   * invalidate stale cache entries automatically when an org updates
   * its colors/logo, without requiring a manual localStorage clear. */
  updatedAt?: string | null;
}

function readCache(orgId: string): CachedBranding | null {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_PREFIX + orgId);
    return raw ? (JSON.parse(raw) as CachedBranding) : null;
  } catch {
    return null;
  }
}

function writeCache(orgId: string, b: CachedBranding) {
  try {
    localStorage.setItem(BRANDING_CACHE_PREFIX + orgId, JSON.stringify(b));
  } catch {
    /* noop */
  }
}

function writeSlugCache(slug: string, b: CachedBranding) {
  try {
    localStorage.setItem(BRANDING_SLUG_CACHE_PREFIX + slug, JSON.stringify(b));
  } catch {
    /* noop */
  }
}

function readSlugCache(slug: string): CachedBranding | null {
  try {
    const raw = localStorage.getItem(BRANDING_SLUG_CACHE_PREFIX + slug);
    return raw ? (JSON.parse(raw) as CachedBranding) : null;
  } catch {
    return null;
  }
}

/**
 * Preload an org logo so the header <img> can paint instantly from the
 * HTTP/image cache when branding changes. Idempotent — repeated calls
 * with the same URL are a no-op.
 */
function preloadLogo(url: string | null) {
  if (!url || typeof document === "undefined") return;
  try {
    const selector = 'link[rel="preload"][as="image"][data-branding-logo="true"]';
    const existing = document.head.querySelector(selector) as HTMLLinkElement | null;
    if (existing?.href === url) {
      // Already preloaded — still trigger Image() to ensure decode.
    } else {
      if (existing?.parentNode) existing.parentNode.removeChild(existing);
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.setAttribute("data-branding-logo", "true");
      link.setAttribute("fetchpriority", "high");
      document.head.appendChild(link);
    }
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  } catch {
    /* noop */
  }
}

interface Branding {
  logoUrl: string | null;
  orgName: string;
  primary: string | null;   // hex
  secondary: string | null;
  accent: string | null;
  loading: boolean;
}

const Ctx = createContext<Branding>({ logoUrl: null, orgName: "", primary: null, secondary: null, accent: null, loading: true });

/** Convert "#rrggbb" → "h s% l%" string for CSS HSL tokens. */
function hexToHslTokens(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Parse "h s% l%" → numeric lightness (0-100) for contrast decisions. */
function tokenLightness(token: string | null): number | null {
  if (!token) return null;
  const m = /\s(\d+(?:\.\d+)?)%$/.exec(token.trim());
  return m ? Number(m[1]) : null;
}

function applyBrandingToDocument(
  b: { primary: string | null; secondary: string | null; accent: string | null },
  options: { reset?: boolean } = {},
) {
  const root = document.documentElement;
  const primary = b.primary ? hexToHslTokens(b.primary) : null;
  const accent = b.accent ? hexToHslTokens(b.accent) : null;
  const secondary = b.secondary ? hexToHslTokens(b.secondary) : null;

  // Only clear previously-set vars when we're explicitly resetting
  // (e.g. switching to a neutral admin route). Otherwise we keep the
  // current values in place to avoid a flash of the default theme
  // before the new org branding loads.
  if (options.reset) {
    const VARS = [
      "--primary", "--ring", "--sidebar-primary", "--sidebar-ring",
      "--accent", "--secondary",
      "--gradient-primary", "--gradient-accent",
      "--sidebar-background", "--sidebar-foreground",
      "--sidebar-accent", "--sidebar-accent-foreground",
      "--sidebar-border", "--sidebar-item", "--sidebar-item-foreground",
      "--sidebar-icon-start", "--sidebar-icon-end",
    ];
    for (const v of VARS) root.style.removeProperty(v);
    return;
  }

  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-ring", primary);
    root.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${primary} / 0.85) 100%)`,
    );
  }
  if (accent) {
    root.style.setProperty("--accent", accent);
    root.style.setProperty(
      "--gradient-accent",
      `linear-gradient(135deg, hsl(${accent}) 0%, hsl(${accent} / 0.85) 100%)`,
    );
  }
  if (secondary) {
    // keep secondary as a soft tint — don't override the muted background entirely
    root.style.setProperty("--secondary", secondary);
  }

  // Pick the darkest available brand color as the sidebar background, so the
  // navigation rail visually matches the heaviest tone of the organization's
  // logo (e.g. for "صواب" — the dark blue used for the wordmark).
  const candidates = [
    { token: secondary, l: tokenLightness(secondary) },
    { token: primary, l: tokenLightness(primary) },
  ].filter((c) => c.token && c.l !== null) as { token: string; l: number }[];
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.l - b.l);
    const bg = candidates[0];
    if (bg.l <= 55) {
      root.style.setProperty("--sidebar-background", bg.token);
      root.style.setProperty("--sidebar-foreground", "0 0% 100%");
      root.style.setProperty("--sidebar-border", `${bg.token.replace(/\d+%$/, `${Math.max(bg.l - 8, 5)}%`)}`);
      root.style.setProperty("--sidebar-accent", `${bg.token.replace(/\d+%$/, `${Math.min(bg.l + 10, 95)}%`)}`);
      root.style.setProperty("--sidebar-accent-foreground", "0 0% 100%");
    } else {
      root.style.removeProperty("--sidebar-background");
      root.style.removeProperty("--sidebar-foreground");
      root.style.removeProperty("--sidebar-border");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--sidebar-accent-foreground");
    }
  }
}

export function OrgBrandingProvider({ children }: { children: ReactNode }) {
  const { currentOrg, loading: orgLoading } = useOrganization();
  const location = useLocation();
  const routeUsesOrgBranding = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/demo")) return false;
    const isAdminRoute = path.startsWith("/admin");
    // Admin routes ALWAYS use the neutral super-admin identity (turquoise/green),
    // regardless of which organization is being viewed. Org colors only return
    // when admin pages are embedded inside an org's internal dashboard iframe
    // (?embedded=1), where they intentionally inherit the host org's brand.
    const isEmbedded = new URLSearchParams(location.search).get("embedded") === "1";
    if (isAdminRoute) return isEmbedded;
    return true;
  }, [location.pathname, location.search]);
  const [branding, setBranding] = useState<Branding>(() => {
    // Synchronously hydrate from slug-keyed cache on first render so the
    // very first paint already has the correct org colors — no flicker.
    try {
      const path = window.location.pathname || "";
      const search = window.location.search || "";
      const seg = path.split("/").filter(Boolean);
      let slug: string | null = null;
      const qs = new URLSearchParams(search).get("org");
      if (qs) slug = qs;
      else if (seg[0] === "admin" && seg.length >= 3 && /^orgs?$|^organizations?$/.test(seg[1])) slug = seg[2];
      else if (seg[0] && seg[0] !== "admin") slug = seg[0];
      if (slug) {
        const c = readSlugCache(slug);
        if (c) {
          return {
            logoUrl: c.logoUrl,
            orgName: "",
            primary: c.primary,
            secondary: c.secondary,
            accent: c.accent,
            loading: true,
          };
        }
      }
    } catch { /* noop */ }
    return {
      logoUrl: null,
      orgName: "",
      primary: null,
      secondary: null,
      accent: null,
      loading: true,
    };
  });
  const [appliedOrgId, setAppliedOrgId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (orgLoading) {
        return;
      }
      if (!currentOrg) {
        setBranding({ logoUrl: null, orgName: "", primary: null, secondary: null, accent: null, loading: false });
        return;
      }
      // 1) Hydrate immediately from cache (synchronous) so the new org's
      //    branding is applied on the very first paint — no flash, no
    //    flicker of the previous org or the default theme.
      const cached = readCache(currentOrg.id);
      if (cached) {
        setBranding({
          logoUrl: cached.logoUrl ?? currentOrg.logo_url ?? null,
          orgName: currentOrg.name,
          primary: cached.primary,
          secondary: cached.secondary,
          accent: cached.accent,
          loading: false,
        });
      } else {
        // No cache yet for this org. CRITICAL: never set primary/accent to
        // null while loading — that would force a re-render where the entire
        // page repaints with the default theme, then repaints again with the
        // org colors when the API responds (the visible "shake" / flicker
        // under the header). Instead, KEEP the currently-applied CSS
        // variables intact and only update the org name + logo. The colors
        // will be replaced atomically in a single repaint when the API
        // returns the real branding below.
        setBranding((prev) => ({
          logoUrl: currentOrg.logo_url ?? prev.logoUrl ?? null,
          orgName: currentOrg.name,
          primary: prev.primary,
          secondary: prev.secondary,
          accent: prev.accent,
          loading: true,
        }));
      }

      // 2) Then fetch the latest from the database in the background and
      //    update both state and cache if anything changed.
      const { data: brandingRows } = await supabase
        .rpc("get_org_branding", { _org_id: currentOrg.id });
      const data = Array.isArray(brandingRows) ? brandingRows[0] ?? null : null;
      if (cancelled) return;
      const fetchedVersion =
        (data as Record<string, string | null> | null)?.updated_at || null;
      // If cache version matches DB version, skip the state update entirely
      // — there's nothing new to paint and we avoid an unnecessary re-render.
      if (cached && cached.updatedAt && fetchedVersion && cached.updatedAt === fetchedVersion) {
        setBranding((prev) => (prev.loading ? { ...prev, loading: false } : prev));
        return;
      }
      const next: Branding = {
        logoUrl: data?.logo_url || currentOrg.logo_url || null,
        orgName: currentOrg.name,
        primary: (data as Record<string, string | null> | null)?.primary_color || FALLBACK_BRANDING.primary,
        secondary: (data as Record<string, string | null> | null)?.secondary_color || FALLBACK_BRANDING.secondary,
        accent: (data as Record<string, string | null> | null)?.accent_color || FALLBACK_BRANDING.accent,
        loading: false,
      };
      writeCache(currentOrg.id, {
        logoUrl: next.logoUrl,
        primary: next.primary,
        secondary: next.secondary,
        accent: next.accent,
        updatedAt: fetchedVersion,
      });
      if (currentOrg.slug) {
        writeSlugCache(currentOrg.slug, {
          logoUrl: next.logoUrl,
          primary: next.primary,
          secondary: next.secondary,
          accent: next.accent,
          updatedAt: fetchedVersion,
        });
      }
      setBranding((prev) => {
        // Avoid a needless re-render (and any chance of repaint) when the
        // freshly-fetched values are identical to what we already applied
        // from cache.
        if (
          prev.primary === next.primary &&
          prev.accent === next.accent &&
          prev.secondary === next.secondary &&
          prev.logoUrl === next.logoUrl &&
          prev.orgName === next.orgName &&
          !prev.loading
        ) {
          return prev;
        }
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [currentOrg, orgLoading]);

  useLayoutEffect(() => {
    // Admin routes normally use the neutral admin theme. However, when an
    // admin is browsing inside a specific organization (e.g. /admin/orgs/:slug
    // or any /admin/.../<slug>/... route), apply that organization's branding
    // so internal pages (employees, plans, ...) match the org identity.
    if (routeUsesOrgBranding) {
      // Apply whatever colors we currently have — these come from either
      // the synchronous cache (no network) or the freshly fetched data.
      // We never clear vars here, so the previous org's colors stay on
      // screen until the new ones overwrite them in a single repaint.
      if (branding.primary || branding.accent || branding.secondary) {
        applyBrandingToDocument(branding);
        setAppliedOrgId(currentOrg?.id ?? null);
      }
      // Warm the image cache for the active logo so the header swap is
      // smooth — even if the URL just changed via the background API
      // revalidate or an org switch.
      if (branding.logoUrl) preloadLogo(branding.logoUrl);
    } else {
      if (appliedOrgId) {
        applyBrandingToDocument({ primary: null, secondary: null, accent: null }, { reset: true });
        setAppliedOrgId(null);
      }
    }

    // Mark <html> with data-org-branded so the global CSS override layer
    // (in index.css) re-routes hardcoded Tailwind color classes
    // (blue/cyan/teal/emerald/...) to the org's primary/accent.
    const root = document.documentElement;
      const hasOrgColors =
      routeUsesOrgBranding && (!!branding.primary || !!branding.accent);
    if (hasOrgColors) {
      root.setAttribute("data-org-branded", "true");
    } else {
      root.removeAttribute("data-org-branded");
    }
  }, [branding, routeUsesOrgBranding, currentOrg?.id, appliedOrgId]);

  // The branding "gate" exists ONLY for the very first paint, to prevent
  // a flash of the default theme before any org colors are applied. As
  // soon as we have applied any colors (from cache OR API), we remove
  // the gate and never re-introduce one — otherwise route changes would
  // make the page appear to shake (hide → show → hide → show).
  useLayoutEffect(() => {
    const hasAppliedColors =
      document.documentElement.getAttribute("data-org-branded") === "true" ||
      !!branding.primary ||
      !!branding.accent ||
      !routeUsesOrgBranding;
    if (!hasAppliedColors) return;
    const gate = document.getElementById("__branding_gate__");
    if (gate?.parentNode) gate.parentNode.removeChild(gate);
  }, [branding.primary, branding.accent, routeUsesOrgBranding]);

  const value = useMemo(() => branding, [branding]);
  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrgBranding() {
  return useContext(Ctx);
}