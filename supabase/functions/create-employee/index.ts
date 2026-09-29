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

type Access = {
  allowed: boolean;
  isSuper: boolean;
  isOrgAdmin: boolean;
  isManager: boolean;
};

async function getOrgAccess(
  admin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
): Promise<Access> {
  const { data: isSuper } = await admin.rpc("is_super_admin", {
    _user_id: userId,
  });
  if (isSuper === true) {
    return {
      allowed: true,
      isSuper: true,
      isOrgAdmin: true,
      isManager: true,
    };
  }

  const { data: membership } = await admin
    .from("user_organizations")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (!membership) {
    return {
      allowed: false,
      isSuper: false,
      isOrgAdmin: false,
      isManager: false,
    };
  }

  const [{ data: employee }, { data: scopedAdminRole }] = await Promise.all([
    admin
      .from("employees")
      .select("role_level")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const isOrgAdmin =
    !!scopedAdminRole || employee?.role_level === "admin";
  const isManager =
    isOrgAdmin || employee?.role_level === "manager";

  return {
    allowed: isManager,
    isSuper: false,
    isOrgAdmin,
    isManager,
  };
}

async function getTargetEmployee(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await admin
    .from("employees")
    .select("id, user_id, organization_id, role_level, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function validateManagerReferences(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  directManagerId?: string | null,
  executiveManagerId?: string | null,
) {
  const ids = [directManagerId, executiveManagerId].filter(Boolean) as string[];
  if (!ids.length) return true;

  const { data, error } = await admin
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id)).size === new Set(ids).size;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "إعدادات الخادم غير مكتملة" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "غير مصرح" }, 401);
    }

    const token = authHeader.slice(7).trim();
    const { data: callerData, error: callerError } =
      await admin.auth.getUser(token);

    if (callerError || !callerData?.user) {
      return json({ error: "غير مصرح" }, 401);
    }

    const callerId = callerData.user.id;
    const body = await req.json().catch(() => ({}));

    // Sensitive Auth mutations are authorized from the target employee's
    // organization. Never trust a client-supplied organization for these.
    if (body.action === "update-password" || body.action === "sync-login") {
      const userId = String(body.userId ?? "").trim();
      if (!userId) {
        return json({ success: false, error: "معرف المستخدم مطلوب" }, 400);
      }

      const target = await getTargetEmployee(admin, userId);
      if (!target?.organization_id) {
        return json({ success: false, error: "الموظف غير موجود" }, 404);
      }

      const access = await getOrgAccess(
        admin,
        callerId,
        target.organization_id,
      );
      if (!access.allowed) {
        return json({ success: false, error: "ليس لديك صلاحية على هذا الموظف" }, 403);
      }

      // A manager cannot mutate credentials of another manager, and only the
      // platform super admin may mutate an organization admin's credentials.
      if (
        !access.isSuper &&
        (
          target.role_level === "admin" ||
          (target.role_level === "manager" && !access.isOrgAdmin)
        )
      ) {
        return json({ success: false, error: "صلاحية أعلى مطلوبة لتعديل هذا الحساب" }, 403);
      }

      if (body.action === "update-password") {
        const password = String(body.password ?? "");
        if (!password) {
          return json(
            {
              success: false,
              fieldErrors: { password: "كلمة المرور مطلوبة" },
              error: "كلمة المرور مطلوبة",
            },
            200,
          );
        }

        if (password.length < 8) {
          return json(
            {
              success: false,
              fieldErrors: {
                password: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
              },
            },
            200,
          );
        }

        const { error } = await admin.auth.admin.updateUserById(userId, {
          password,
        });
        if (error) {
          const code = "code" in error ? error.code : undefined;
          const weak =
            code === "weak_password" ||
            /weak|pwned|known to be/i.test(error.message ?? "");
          const short = /at least|short|length/i.test(error.message ?? "");
          const message = weak
            ? "كلمة المرور ضعيفة أو مكشوفة في تسريبات معروفة. اختر كلمة مرور أقوى وغير شائعة."
            : short
              ? "كلمة المرور قصيرة جداً. استخدم 8 أحرف على الأقل."
              : "حدث خطأ أثناء تحديث كلمة المرور";

          return json(
            weak || short
              ? {
                  success: false,
                  fieldErrors: { password: message },
                  error: message,
                }
              : { success: false, error: message },
            weak || short ? 200 : 500,
          );
        }

        return json({
          success: true,
          message: "تم تحديث كلمة المرور بنجاح",
        });
      }

      const username = String(body.username ?? "").trim();
      if (!username) {
        return json(
          { success: false, error: "رقم الهوية مطلوب" },
          400,
        );
      }

      const cleanUsername = username
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      if (!cleanUsername) {
        return json(
          { success: false, error: "رقم الهوية غير صالح" },
          400,
        );
      }

      const internalEmail = `${cleanUsername}@user.local`;
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email: internalEmail,
        email_confirm: true,
        user_metadata: { username },
      });

      if (error) {
        const message = error.message?.includes("already been registered")
          ? "رقم الهوية مرتبط بحساب آخر"
          : "حدث خطأ أثناء ربط بيانات الدخول";
        return json({ success: false, error: message }, 500);
      }

      return json({
        success: true,
        message: "تم ربط بيانات الدخول بنجاح",
        loginEmail: internalEmail,
      });
    }

    const organizationId = String(body.organizationId ?? "").trim();
    if (!organizationId) {
      return json(
        {
          success: false,
          error: "تعذر تحديد الجمعية التي سيضاف إليها الموظف",
        },
        400,
      );
    }

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id, is_active")
      .eq("id", organizationId)
      .maybeSingle();

    if (organizationError || !organization) {
      return json({ success: false, error: "الجمعية غير موجودة" }, 404);
    }
    if (!organization.is_active) {
      return json({ success: false, error: "الجمعية موقوفة حالياً" }, 409);
    }

    const access = await getOrgAccess(admin, callerId, organizationId);
    if (!access.allowed) {
      return json(
        { success: false, error: "ليس لديك صلاحية لإضافة موظفين لهذه الجمعية" },
        403,
      );
    }

    const fullName = String(body.fullName ?? "").trim();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const jobRole = String(body.jobRole ?? "").trim();
    const roleColor = String(body.roleColor ?? "").trim();
    const avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
    const directManagerId = body.directManagerId
      ? String(body.directManagerId)
      : null;
    const executiveManagerId = body.executiveManagerId
      ? String(body.executiveManagerId)
      : null;

    const requestedRoleLevel = ["employee", "manager", "admin"].includes(
      body.roleLevel,
    )
      ? body.roleLevel
      : "employee";

    const fieldErrors: Record<string, string> = {};
    if (!fullName) fieldErrors.name = "الاسم الكامل مطلوب";
    if (!username) fieldErrors.username = "رقم الهوية مطلوب";
    if (!password) fieldErrors.password = "كلمة المرور مطلوبة";
    if (!email) fieldErrors.email = "البريد الإلكتروني مطلوب";
    if (!phone) fieldErrors.phone = "رقم الجوال مطلوب";
    if (!jobRole) fieldErrors.role = "الدور الوظيفي مطلوب";

    if (Object.keys(fieldErrors).length) {
      return json({ success: false, fieldErrors }, 200);
    }

    if (password.length < 8) {
      return json(
        {
          success: false,
          fieldErrors: {
            password: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
          },
        },
        200,
      );
    }

    if (requestedRoleLevel === "admin" && !access.isSuper) {
      return json(
        {
          success: false,
          error: "منح صلاحية مدير الجمعية متاح لمدير النظام فقط",
        },
        403,
      );
    }

    if (
      requestedRoleLevel === "manager" &&
      !access.isSuper &&
      !access.isOrgAdmin
    ) {
      return json(
        {
          success: false,
          error: "منح مستوى مدير متاح لمدير الجمعية أو مدير النظام فقط",
        },
        403,
      );
    }

    const managerRefsValid = await validateManagerReferences(
      admin,
      organizationId,
      directManagerId,
      executiveManagerId,
    );
    if (!managerRefsValid) {
      return json(
        {
          success: false,
          error: "أحد المديرين المحددين لا يتبع الجمعية الحالية",
        },
        400,
      );
    }

    const [
      { data: existingUsername },
      { data: existingEmail },
      { data: existingPhone },
    ] = await Promise.all([
      admin
        .from("employees")
        .select("id")
        .eq("username", username)
        .maybeSingle(),
      admin
        .from("employees")
        .select("id")
        .eq("email", email)
        .maybeSingle(),
      admin
        .from("employees")
        .select("id")
        .eq("phone", phone)
        .maybeSingle(),
    ]);

    if (existingUsername) {
      return json(
        {
          success: false,
          fieldErrors: { username: "رقم الهوية مسجل مسبقاً" },
        },
        200,
      );
    }
    if (existingEmail) {
      return json(
        {
          success: false,
          fieldErrors: { email: "البريد الإلكتروني مسجل مسبقاً" },
        },
        200,
      );
    }
    if (existingPhone) {
      return json(
        {
          success: false,
          fieldErrors: { phone: "رقم الجوال مسجل مسبقاً" },
        },
        200,
      );
    }

    const cleanUsername = username
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    if (!cleanUsername) {
      return json(
        {
          success: false,
          fieldErrors: { username: "رقم الهوية غير صالح" },
        },
        200,
      );
    }

    const internalEmail = `${cleanUsername}@user.local`;

    const { data: authData, error: createUserError } =
      await admin.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
          phone,
          email,
          organization_id: organizationId,
        },
      });

    if (createUserError || !authData?.user) {
      const message = createUserError?.message ?? "";
      if (message.includes("already been registered")) {
        return json(
          {
            success: false,
            fieldErrors: { username: "رقم الهوية مسجل مسبقاً" },
          },
          200,
        );
      }
      if (/weak|pwned|known to be/i.test(message)) {
        return json(
          {
            success: false,
            fieldErrors: {
              password:
                "كلمة المرور ضعيفة أو مكشوفة في تسريبات معروفة. اختر كلمة مرور أقوى وغير شائعة.",
            },
          },
          200,
        );
      }
      return json(
        { success: false, error: "حدث خطأ أثناء إنشاء الحساب" },
        500,
      );
    }

    const newUserId = authData.user.id;
    let employeeId: string | null = null;
    let membershipCreated = false;

    const rollback = async () => {
      await admin
        .from("user_roles")
        .delete()
        .eq("user_id", newUserId)
        .then(() => {}, () => {});
      if (membershipCreated) {
        await admin
          .from("user_organizations")
          .delete()
          .eq("user_id", newUserId)
          .eq("organization_id", organizationId)
          .then(() => {}, () => {});
      }
      if (employeeId) {
        await admin
          .from("employees")
          .delete()
          .eq("id", employeeId)
          .then(() => {}, () => {});
      }
      await admin.auth.admin
        .deleteUser(newUserId)
        .then(() => {}, () => {});
    };

    try {
      const { data: employee, error: employeeError } = await admin
        .from("employees")
        .insert({
          user_id: newUserId,
          organization_id: organizationId,
          full_name: fullName,
          username,
          email,
          phone,
          job_role: jobRole,
          role_color: roleColor || "bg-primary",
          avatar_url: avatarUrl,
          status: "active",
          direct_manager_id: directManagerId,
          executive_manager_id: executiveManagerId,
          role_level: requestedRoleLevel,
        })
        .select()
        .single();

      if (employeeError || !employee) {
        throw employeeError ?? new Error("employee_insert_failed");
      }
      employeeId = employee.id;

      const { error: membershipError } = await admin
        .from("user_organizations")
        .insert({
          user_id: newUserId,
          organization_id: organizationId,
          role_in_org:
            requestedRoleLevel === "admin" ? "admin" : "member",
          is_default: true,
          approval_status: "approved",
          requested_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: callerId,
        });

      if (membershipError) throw membershipError;
      membershipCreated = true;

      const assignedRole =
        requestedRoleLevel === "admin" ? "admin" : "user";

      const { error: roleError } = await admin
        .from("user_roles")
        .insert({
          user_id: newUserId,
          role: assignedRole,
          organization_id:
            assignedRole === "admin" ? organizationId : null,
        });

      if (roleError) throw roleError;

      return json({
        success: true,
        message: "تم إضافة الموظف بنجاح",
        employee,
      });
    } catch (error) {
      console.error("create-employee transaction rollback:", error);
      await rollback();
      return json(
        {
          success: false,
          error:
            "تعذر إكمال إنشاء الموظف، وتم التراجع عن الحساب الجزئي تلقائياً",
        },
        500,
      );
    }
  } catch (error) {
    console.error("create-employee error:", error);
    return json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});
