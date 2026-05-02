import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEFAULT_PASSWORD = "Viewer@2026";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "غير مصرح" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "غير مصرح" }, 401);

    const requestingUserId = claimsData.claims.sub as string;

    const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
      admin.rpc("has_role", { _user_id: requestingUserId, _role: "admin" }),
      admin.rpc("is_super_admin", { _user_id: requestingUserId }),
    ]);
    if (!isAdmin && !isSuperAdmin) {
      return json({ error: "صلاحية غير كافية" }, 403);
    }

    // Load all active organizations
    const { data: orgs, error: orgsErr } = await admin
      .from("organizations")
      .select("id, name, slug, logo_url")
      .eq("is_active", true);
    if (orgsErr) return json({ error: orgsErr.message }, 500);

    const results: Array<{
      org: string;
      slug: string | null;
      status: "created" | "exists" | "error";
      username?: string;
      password?: string;
      message?: string;
    }> = [];

    for (const org of orgs || []) {
      try {
        const slug = (org.slug || org.id.slice(0, 8)).toLowerCase().replace(/[^a-z0-9]/g, "");
        const username = `viewer-${org.slug || org.id.slice(0, 8)}`;
        const cleanUsername = `viewer${slug}`;
        const internalEmail = `${cleanUsername}@user.local`;

        // Check if a viewer account already exists for this org
        const { data: existing } = await admin
          .from("employees")
          .select("id, user_id, username")
          .eq("organization_id", org.id)
          .eq("is_viewer_account", true)
          .maybeSingle();

        if (existing) {
          results.push({
            org: org.name,
            slug: org.slug,
            status: "exists",
            username: existing.username || username,
            message: "موجود مسبقاً",
          });
          continue;
        }

        // Create the auth user
        const { data: authData, error: createErr } =
          await admin.auth.admin.createUser({
            email: internalEmail,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: {
              full_name: org.name,
              username,
              is_viewer_account: true,
              organization_id: org.id,
            },
          });

        if (createErr || !authData?.user) {
          results.push({
            org: org.name,
            slug: org.slug,
            status: "error",
            message: createErr?.message || "فشل إنشاء الحساب",
          });
          continue;
        }

        // Create employee record (the viewer profile)
        const { error: empErr } = await admin.from("employees").insert({
          user_id: authData.user.id,
          full_name: org.name,
          username,
          email: internalEmail,
          job_role: "حساب عرض",
          title: "حساب عرض الجمعية",
          avatar_url: org.logo_url,
          status: "active",
          role_level: "employee",
          organization_id: org.id,
          is_viewer_account: true,
        });

        if (empErr) {
          await admin.auth.admin.deleteUser(authData.user.id);
          results.push({
            org: org.name,
            slug: org.slug,
            status: "error",
            message: empErr.message,
          });
          continue;
        }

        // Link to the organization as their default org
        await admin.from("user_organizations").insert({
          user_id: authData.user.id,
          organization_id: org.id,
          is_default: true,
        });

        // Assign 'viewer' role
        await admin.from("user_roles").insert({
          user_id: authData.user.id,
          role: "viewer",
        });

        results.push({
          org: org.name,
          slug: org.slug,
          status: "created",
          username,
          password: DEFAULT_PASSWORD,
        });
      } catch (e: any) {
        results.push({
          org: org.name,
          slug: org.slug,
          status: "error",
          message: e?.message || "خطأ غير متوقع",
        });
      }
    }

    return json({ success: true, results });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message || "حدث خطأ غير متوقع" }, 500);
  }
});