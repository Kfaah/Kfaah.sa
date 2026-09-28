import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export class KfaahAuthorizationError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "KfaahAuthorizationError";
    this.status = status;
  }
}

function bearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export function isServiceRoleRequest(req: Request): boolean {
  const token = bearerToken(req);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!token && !!serviceKey && token === serviceKey;
}

export async function requireAuthenticatedUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new KfaahAuthorizationError("إعدادات المصادقة غير مكتملة", 500);
  }

  const token = bearerToken(req);
  if (!token) {
    throw new KfaahAuthorizationError("غير مصرح", 401);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new KfaahAuthorizationError("غير مصرح", 401);
  }
  return data.user;
}

export async function requireTrustedCaller(req: Request) {
  if (isServiceRoleRequest(req)) {
    return { kind: "service_role" as const, user: null };
  }
  const user = await requireAuthenticatedUser(req);
  return { kind: "user" as const, user };
}

export async function requireOrganizationAccess(
  req: Request,
  organizationId: string,
  admin: any,
) {
  if (isServiceRoleRequest(req)) {
    return { kind: "service_role" as const, user: null };
  }

  const user = await requireAuthenticatedUser(req);

  const { data: isSuper, error: superError } = await admin.rpc("is_super_admin", {
    _user_id: user.id,
  });
  if (!superError && isSuper === true) {
    return { kind: "user" as const, user };
  }

  const { data: membership, error: membershipError } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new KfaahAuthorizationError("لا تملك صلاحية الوصول إلى هذه الجمعية", 403);
  }
  return { kind: "user" as const, user };
}

export function authorizationErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
): Response | null {
  if (!(error instanceof KfaahAuthorizationError)) return null;
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
