import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  is_active: boolean;
  subscription_tier: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  availableOrgs: Organization[];
  isSuperAdmin: boolean;
  loading: boolean;
  switchOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = "active_organization_id";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const location = useLocation();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!authUser) {
      setCurrentOrg(null);
      setAvailableOrgs([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: superCheck } = await supabase.rpc("is_super_admin", {
        _user_id: authUser.id,
      });
      const superAdmin = !!superCheck;
      setIsSuperAdmin(superAdmin);

      // Super admin sees all orgs; regular users see only their joined orgs
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load organizations:", error);
        setAvailableOrgs([]);
        setCurrentOrg(null);
        return;
      }

      const list = (orgs as Organization[]) || [];
      setAvailableOrgs(list);

      const segments = location.pathname.split("/").filter(Boolean);
      const searchOrgSlug = new URLSearchParams(location.search).get("org");
      let routeSlug: string | null = null;
      if (searchOrgSlug) {
        routeSlug = searchOrgSlug;
      } else if (segments[0] === "admin" && segments.length >= 3 && /^orgs?$|^organizations?$/.test(segments[1])) {
        routeSlug = segments[2];
      } else if (segments[0] && segments[0] !== "admin") {
        routeSlug = segments[0];
      }
      const slugMatch = routeSlug ? list.find((o) => o.slug === routeSlug) : null;
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferred = stored ? list.find((o) => o.id === stored) : null;
      const nextOrg = slugMatch || preferred || list[0] || null;

      if (nextOrg) {
        localStorage.setItem(STORAGE_KEY, nextOrg.id);
      }

      setCurrentOrg(nextOrg);
    } finally {
      setLoading(false);
    }
  }, [authUser, location.pathname, location.search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!availableOrgs.length) return;

    // Resolve the org slug from either the first path segment (/sakinah/...)
    // or from admin org-scoped routes (/admin/orgs/:slug/..., /admin/organizations/:slug/...).
    const segments = location.pathname.split("/").filter(Boolean);
    const searchOrgSlug = new URLSearchParams(location.search).get("org");
    let routeSlug: string | null = null;
    if (searchOrgSlug) {
      routeSlug = searchOrgSlug;
    } else if (segments[0] === "admin" && segments.length >= 3 && /^orgs?$|^organizations?$/.test(segments[1])) {
      routeSlug = segments[2];
    } else if (segments[0] && segments[0] !== "admin") {
      routeSlug = segments[0];
    }
    if (!routeSlug) return;

    const slugMatch = availableOrgs.find((org) => org.slug === routeSlug);
    if (!slugMatch || slugMatch.id === currentOrg?.id) return;

    localStorage.setItem(STORAGE_KEY, slugMatch.id);
    setCurrentOrg(slugMatch);
  }, [availableOrgs, currentOrg?.id, location.pathname, location.search]);

  const switchOrg = (orgId: string) => {
    const target = availableOrgs.find((o) => o.id === orgId);
    if (!target) return;
    localStorage.setItem(STORAGE_KEY, orgId);
    setCurrentOrg(target);
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        availableOrgs,
        isSuperAdmin,
        loading,
        switchOrg,
        refresh: load,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
