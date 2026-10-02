import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOrgPrivilegeFlags } from "@/lib/orgAuthorization";

export type ViewScope = "personal" | "team";

export type RoleLevel = "employee" | "manager" | "admin";

interface ScopedView {
  /** Current selected scope */
  scope: ViewScope;
  /** Setter for the scope */
  setScope: (s: ViewScope) => void;
  /** The current user's role_level (admin / manager / employee) */
  roleLevel: RoleLevel;
  /** Whether the toggle should appear (managers + admins) */
  canToggle: boolean;
  /** Loading flag while we resolve role + subordinates */
  loading: boolean;
  /** The current employee.id (or null if no employee record) */
  myEmployeeId: string | null;
  /** All employee.id under the current user (recursive). Empty for plain employees. */
  subordinateEmployeeIds: string[];
  /** All auth user_ids under the current user (recursive). */
  subordinateUserIds: string[];
  /**
   * Convenience: the set of employee_ids the user currently has visibility on
   * given the active scope. For 'personal' it's [myEmployeeId], for 'team'
   * it's all subordinates (admin sees all → returns null meaning "no filter").
   */
  visibleEmployeeIds: string[] | null;
}

/**
 * Returns the active scope (personal vs team) for managers/admins,
 * resolves the user's role_level, and lists their subordinates.
 *
 * Plain employees always get { scope: 'personal', canToggle: false }.
 * Admins always see all data — visibleEmployeeIds returns `null` to mean
 * "no employee filter, show org-wide data".
 */
export function useScopedView(storageKey = "scope:default"): ScopedView {
  const { user: authUser } = useAuth();
  const { currentOrg } = useOrganization();
  const [scope, setScopeState] = useState<ViewScope>("personal");
  const [roleLevel, setRoleLevel] = useState<RoleLevel>("employee");
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [subordinateEmployeeIds, setSubordinateEmployeeIds] = useState<string[]>([]);
  const [subordinateUserIds, setSubordinateUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore last selection
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "team" || saved === "personal") setScopeState(saved);
  }, [storageKey]);

  const setScope = useCallback(
    (s: ViewScope) => {
      setScopeState(s);
      localStorage.setItem(storageKey, s);
    },
    [storageKey]
  );

  const load = useCallback(async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!currentOrg?.id) {
        setRoleLevel("employee");
        setMyEmployeeId(null);
        setSubordinateEmployeeIds([]);
        setSubordinateUserIds([]);
        return;
      }

      // 1) Find my employee record inside the active organization.
      const { data: emp } = await supabase
        .from("employees")
        .select("id, role_level")
        .eq("user_id", authUser.id)
        .eq("organization_id", currentOrg.id)
        .maybeSingle();

      const flags = await getOrgPrivilegeFlags(
        authUser.id,
        currentOrg.id,
      );

      let resolvedRole: RoleLevel =
        flags.isSuperAdmin || flags.isOrgAdmin
          ? "admin"
          : emp?.role_level === "manager"
            ? "manager"
            : "employee";

      setRoleLevel(resolvedRole);
      setMyEmployeeId(emp?.id ?? null);

      // 2) Fetch and re-filter subordinates to the active organization.
      if (resolvedRole !== "employee" && emp?.id) {
        const { data: subEmp } = await supabase.rpc(
          "get_subordinate_employee_ids",
          { _manager_employee_id: emp.id },
        );
        const candidateIds = ((subEmp as any[]) || [])
          .map((row) => row.employee_id)
          .filter(Boolean);

        if (candidateIds.length) {
          const { data: scopedEmployees } = await supabase
            .from("employees")
            .select("id, user_id")
            .eq("organization_id", currentOrg.id)
            .in("id", candidateIds);

          setSubordinateEmployeeIds(
            (scopedEmployees ?? []).map((row) => row.id),
          );
          setSubordinateUserIds(
            (scopedEmployees ?? [])
              .map((row) => row.user_id)
              .filter(Boolean) as string[],
          );
        } else {
          setSubordinateEmployeeIds([]);
          setSubordinateUserIds([]);
        }
      } else {
        setSubordinateEmployeeIds([]);
        setSubordinateUserIds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [authUser, currentOrg?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canToggle = roleLevel === "manager" || roleLevel === "admin";

  const visibleEmployeeIds = useMemo<string[] | null>(() => {
    if (roleLevel === "admin") {
      // Admin always sees everything → no filter
      return null;
    }
    if (scope === "personal") {
      return myEmployeeId ? [myEmployeeId] : [];
    }
    // team scope: include self + subordinates
    return myEmployeeId
      ? Array.from(new Set([myEmployeeId, ...subordinateEmployeeIds]))
      : subordinateEmployeeIds;
  }, [roleLevel, scope, myEmployeeId, subordinateEmployeeIds]);

  // Admins start in "team" view (since they don't have personal data)
  useEffect(() => {
    if (roleLevel === "admin" && scope === "personal") {
      setScopeState("team");
    }
  }, [roleLevel, scope]);

  return {
    scope,
    setScope,
    roleLevel,
    canToggle,
    loading,
    myEmployeeId,
    subordinateEmployeeIds,
    subordinateUserIds,
    visibleEmployeeIds,
  };
}
