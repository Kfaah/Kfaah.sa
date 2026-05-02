import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: userData.user.id });
    const { employee_id } = await req.json();
    if (!employee_id) {
      return new Response(JSON.stringify({ error: "employee_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id, user_id, organization_id, full_name")
      .eq("id", employee_id)
      .maybeSingle();
    if (empErr || !emp) {
      return new Response(JSON.stringify({ error: "الموظف غير موجود" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: super admin OR org admin in same org
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: belongs } = await admin.rpc("user_belongs_to_org", {
        _user_id: userData.user.id,
        _org_id: emp.organization_id,
      });
      const { data: hasAdmin } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      allowed = !!belongs && !!hasAdmin;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detach all manager references first (avoid FK violations when deleting managers)
    const { error: detachErr } = await admin
      .from("employees")
      .update({ direct_manager_id: null })
      .eq("direct_manager_id", emp.id);
    if (detachErr) throw detachErr;

    const { error: detachExecutiveErr } = await admin
      .from("employees")
      .update({ executive_manager_id: null })
      .eq("executive_manager_id", emp.id);
    if (detachExecutiveErr) throw detachExecutiveErr;

    // Detach functional manager links if such column exists (best-effort)
    await admin
      .from("employees")
      .update({ functional_manager_id: null })
      .eq("functional_manager_id", emp.id)
      .then(() => {}, () => {});

    // Delete employee row
    const { error: delErr } = await admin.from("employees").delete().eq("id", emp.id);
    if (delErr) throw delErr;

    // Cleanup linked auth user (best-effort)
    if (emp.user_id) {
      await admin.from("user_organizations").delete().eq("user_id", emp.user_id).eq("organization_id", emp.organization_id);
      await admin.from("user_roles").delete().eq("user_id", emp.user_id);
      await admin.auth.admin.deleteUser(emp.user_id).catch((e) => console.error("auth delete:", e));
    }

    return new Response(JSON.stringify({ success: true, name: emp.full_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-employee error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});