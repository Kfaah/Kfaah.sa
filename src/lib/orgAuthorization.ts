import { supabase } from "@/integrations/supabase/client";

export type OrgPrivilegeFlags = {
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isModerator: boolean;
  isHrManager: boolean;
  isFinanceManager: boolean;
};

const EMPTY_FLAGS: OrgPrivilegeFlags = {
  isSuperAdmin: false,
  isOrgAdmin: false,
  isModerator: false,
  isHrManager: false,
  isFinanceManager: false,
};

export async function getOrgPrivilegeFlags(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
): Promise<OrgPrivilegeFlags> {
  if (!userId) return EMPTY_FLAGS;

  const { data: isSuper, error: superError } = await supabase.rpc(
    "is_super_admin",
    { _user_id: userId },
  );

  if (!superError && isSuper === true) {
    return {
      isSuperAdmin: true,
      isOrgAdmin: true,
      isModerator: true,
      isHrManager: true,
      isFinanceManager: true,
    };
  }

  if (!organizationId) return EMPTY_FLAGS;

  const roleChecks = await Promise.all([
    supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "admin",
      _org: organizationId,
    }),
    supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "moderator",
      _org: organizationId,
    }),
    supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "hr_manager",
      _org: organizationId,
    }),
    supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "finance_manager",
      _org: organizationId,
    }),
  ]);

  return {
    isSuperAdmin: false,
    isOrgAdmin: roleChecks[0].data === true,
    isModerator: roleChecks[1].data === true,
    isHrManager: roleChecks[2].data === true,
    isFinanceManager: roleChecks[3].data === true,
  };
}

export async function canManageOrg(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
): Promise<boolean> {
  const flags = await getOrgPrivilegeFlags(userId, organizationId);
  return flags.isSuperAdmin || flags.isOrgAdmin;
}

export async function canAccessOrgSettings(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
): Promise<boolean> {
  const flags = await getOrgPrivilegeFlags(userId, organizationId);
  return (
    flags.isSuperAdmin ||
    flags.isOrgAdmin ||
    flags.isModerator
  );
}
