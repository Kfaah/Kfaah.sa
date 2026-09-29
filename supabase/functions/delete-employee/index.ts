import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "إعدادات الخادم غير مكتملة" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "غير مصرح" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.slice(7).trim();
    const { data: callerData, error: callerError } =
      await admin.auth.getUser(token);

    if (callerError || !callerData?.user) {
      return json({ error: "غير مصرح" }, 401);
    }

    const callerId = callerData.user.id;
    const { employee_id } = await req.json().catch(() => ({}));

    if (!employee_id) {
      return json({ error: "employee_id required" }, 400);
    }

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select(
        "id, user_id, organization_id, full_name, role_level",
      )
      .eq("id", employee_id)
      .maybeSingle();

    if (employeeError || !employee?.organization_id) {
      return json({ error: "الموظف غير موجود" }, 404);
    }

    const { data: isSuper } = await admin.rpc("is_super_admin", {
      _user_id: callerId,
    });

    let allowed = isSuper === true;
    if (!allowed) {
      const [{ data: membership }, { data: scopedAdminRole }] =
        await Promise.all([
          admin
            .from("user_organizations")
            .select("id")
            .eq("user_id", callerId)
            .eq("organization_id", employee.organization_id)
            .eq("approval_status", "approved")
            .maybeSingle(),
          admin
            .from("user_roles")
            .select("id")
            .eq("user_id", callerId)
            .eq("role", "admin")
            .eq("organization_id", employee.organization_id)
            .maybeSingle(),
        ]);

      allowed = !!membership && !!scopedAdminRole;
    }

    if (!allowed) {
      return json({ error: "غير مصرح" }, 403);
    }

    if (employee.user_id === callerId && isSuper !== true) {
      return json(
        { error: "لا يمكن لمدير الجمعية حذف حسابه بنفسه" },
        403,
      );
    }

    if (employee.user_id && isSuper !== true) {
      const [{ data: targetSuper }, { data: targetAdmin }] =
        await Promise.all([
          admin
            .from("user_roles")
            .select("id")
            .eq("user_id", employee.user_id)
            .eq("role", "super_admin")
            .maybeSingle(),
          admin
            .from("user_roles")
            .select("id")
            .eq("user_id", employee.user_id)
            .eq("role", "admin")
            .eq("organization_id", employee.organization_id)
            .maybeSingle(),
        ]);

      if (targetSuper || targetAdmin || employee.role_level === "admin") {
        return json(
          { error: "حذف مدير جمعية أو مدير نظام يتطلب صلاحية مدير النظام" },
          403,
        );
      }
    }

    // Detach manager references only inside the same organization.
    const { error: directError } = await admin
      .from("employees")
      .update({ direct_manager_id: null })
      .eq("organization_id", employee.organization_id)
      .eq("direct_manager_id", employee.id);
    if (directError) throw directError;

    const { error: executiveError } = await admin
      .from("employees")
      .update({ executive_manager_id: null })
      .eq("organization_id", employee.organization_id)
      .eq("executive_manager_id", employee.id);
    if (executiveError) throw executiveError;

    // Best-effort compatibility with deployments that have the optional
    // functional_manager_id column.
    await admin
      .from("employees")
      .update({ functional_manager_id: null })
      .eq("organization_id", employee.organization_id)
      .eq("functional_manager_id", employee.id)
      .then(() => {}, () => {});

    const { error: deleteEmployeeError } = await admin
      .from("employees")
      .delete()
      .eq("id", employee.id)
      .eq("organization_id", employee.organization_id);
    if (deleteEmployeeError) throw deleteEmployeeError;

    if (employee.user_id) {
      // Remove only the membership and elevated roles owned by this org.
      const { error: membershipDeleteError } = await admin
        .from("user_organizations")
        .delete()
        .eq("user_id", employee.user_id)
        .eq("organization_id", employee.organization_id);
      if (membershipDeleteError) throw membershipDeleteError;

      const { error: scopedRolesDeleteError } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", employee.user_id)
        .eq("organization_id", employee.organization_id);
      if (scopedRolesDeleteError) throw scopedRolesDeleteError;

      const [{ count: otherMemberships }, { count: otherEmployees }] =
        await Promise.all([
          admin
            .from("user_organizations")
            .select("id", { head: true, count: "exact" })
            .eq("user_id", employee.user_id)
            .eq("approval_status", "approved"),
          admin
            .from("employees")
            .select("id", { head: true, count: "exact" })
            .eq("user_id", employee.user_id),
        ]);

      // Delete the Auth identity only when this was the user's final
      // organization presence. Otherwise preserve login and unrelated orgs.
      if ((otherMemberships ?? 0) === 0 && (otherEmployees ?? 0) === 0) {
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", employee.user_id);

        const { error: authDeleteError } =
          await admin.auth.admin.deleteUser(employee.user_id);
        if (authDeleteError) {
          console.error("Auth cleanup failed:", authDeleteError);
        }
      }
    }

    return json({
      success: true,
      name: employee.full_name,
    });
  } catch (error) {
    console.error("delete-employee error:", error);
    return json(
      { error: (error as Error)?.message ?? "حدث خطأ غير متوقع" },
      500,
    );
  }
});
