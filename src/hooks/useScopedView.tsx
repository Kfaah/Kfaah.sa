import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
      // 1) Find my employee record + role_level
      const { data: emp } = await supabase
        .from("employees")
        .select("id, role_level")
        .eq("user_id", authUser.id)
        .maybeSingle();

      let resolvedRole: RoleLevel = "employee";
      if (emp?.role_level) {
        resolvedRole = emp.role_level as RoleLevel;
      } else {
        // Fallback to user_roles
        const { data: roleRow } = await supabase.rpc("get_user_role", {
          _user_id: authUser.id,
        });
        if (roleRow === "admin" || roleRow === "super_admin") resolvedRole = "admin";
      }
      setRoleLevel(resolvedRole);
      setMyEmployeeId(emp?.id ?? null);

      // 2) Fetch subordinates if manager/admin
      if (resolvedRole !== "employee") {
        const { data: subEmp } = await supabase.rpc("get_subordinate_employee_ids", {
          _manager_employee_id: emp?.id ?? "00000000-0000-0000-0000-000000000000",
        });
        const empIds = ((subEmp as any[]) || []).map((r) => r.employee_id);
        setSubordinateEmployeeIds(empIds);

        const { data: subUsers } = await supabase.rpc("get_subordinate_user_ids", {
          _manager_user_id: authUser.id,
        });
        setSubordinateUserIds(((subUsers as any[]) || []).map((r) => r.user_id));
      } else {
        setSubordinateEmployeeIds([]);
        setSubordinateUserIds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [authUser]);

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
