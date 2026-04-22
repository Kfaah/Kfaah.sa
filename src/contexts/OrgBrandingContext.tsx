import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Branding {
  logoUrl: string | null;
  orgName: string;
  primary: string | null;   // hex
  secondary: string | null;
  accent: string | null;
}

const Ctx = createContext<Branding>({ logoUrl: null, orgName: "", primary: null, secondary: null, accent: null });

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

function applyBrandingToDocument(b: { primary: string | null; secondary: string | null; accent: string | null }) {
  const root = document.documentElement;
  // Remove previously set vars first to support resetting back to defaults
  const VARS = [
    "--primary", "--ring", "--sidebar-primary", "--sidebar-ring",
    "--accent", "--secondary",
    "--gradient-primary", "--gradient-accent",
  ];
  for (const v of VARS) root.style.removeProperty(v);

  const primary = b.primary ? hexToHslTokens(b.primary) : null;
  const accent = b.accent ? hexToHslTokens(b.accent) : null;
  const secondary = b.secondary ? hexToHslTokens(b.secondary) : null;

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
}

export function OrgBrandingProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization();
  const [branding, setBranding] = useState<Branding>({
    logoUrl: null, orgName: "", primary: null, secondary: null, accent: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentOrg) {
        setBranding({ logoUrl: null, orgName: "", primary: null, secondary: null, accent: null });
        applyBrandingToDocument({ primary: null, secondary: null, accent: null });
        return;
      }
      const { data } = await supabase
        .from("organization_profiles")
        .select("logo_url, primary_color, secondary_color, accent_color")
        .eq("organization_id", currentOrg.id)
        .maybeSingle();
      if (cancelled) return;
      const next: Branding = {
        logoUrl: data?.logo_url || currentOrg.logo_url || null,
        orgName: currentOrg.name,
        primary: (data as Record<string, string | null> | null)?.primary_color || null,
        secondary: (data as Record<string, string | null> | null)?.secondary_color || null,
        accent: (data as Record<string, string | null> | null)?.accent_color || null,
      };
      setBranding(next);
      applyBrandingToDocument(next);
    })();
    return () => { cancelled = true; };
  }, [currentOrg]);

  const value = useMemo(() => branding, [branding]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrgBranding() {
  return useContext(Ctx);
}