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

    // Only show a loading state on the very first load. Subsequent
    // refreshes (e.g. after route changes) must NOT flip loading back to
    // true, otherwise the branding gate re-hides the body and the page
    // appears to "shake".
    setLoading((prev) => (availableOrgs.length === 0 ? true : prev));
    try {
      const { data: superCheck } = await supabase.rpc("is_super_admin", {
        _user_id: authUser.id,
      });
      const superAdmin = !!superCheck;
      setIsSuperAdmin(superAdmin);

      const orgQuery = supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: true });

      // Super admins can browse every organization. Regular users may belong to
      // more than one approved organization, so load every approved membership
      // and let the current route choose the exact organization. Falling back to
      // get_user_organization_id keeps older accounts working.
      let orgsResult;
      if (superAdmin) {
        orgsResult = await orgQuery;
      } else {
        const { data: memberships, error: membershipsError } = await supabase
          .from("user_organizations")
          .select("organization_id")
          .eq("user_id", authUser.id)
          .eq("approval_status", "approved");

        if (membershipsError) {
          orgsResult = { data: [], error: membershipsError };
        } else {
          const ids = [...new Set((memberships ?? []).map((item) => item.organization_id).filter(Boolean))] as string[];
          if (ids.length === 0) {
            const { data: userOrgId } = await supabase.rpc("get_user_organization_id", {
              _user_id: authUser.id,
            });
            if (userOrgId) ids.push(userOrgId as string);
          }
          orgsResult = ids.length
            ? await orgQuery.in("id", ids)
            : { data: [], error: null };
        }
      }

      const { data: orgs, error } = orgsResult;

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
      const slugMatch = routeSlug ? list.find((o) => o.slug === routeSlug || o.id === routeSlug) : null;
      // For non-super-admin users, ignore unknown routeSlug values — many
      // app routes (e.g. /app, /profile, /tasks, /settings) start with a
      // non-slug segment. Falling back to their own org keeps branding
      // applied across these screens.
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
    // Intentionally depend ONLY on the auth user. Route-driven org
    // changes are handled by the second effect below — re-running the
    // full load on every navigation caused a flash/shake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

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

    const slugMatch = availableOrgs.find((org) => org.slug === routeSlug || org.id === routeSlug);
    // Same fallback as in load(): unknown route segments must NOT clear the
    // active org for regular users — they should always remain branded with
    // their own organization's identity.
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
