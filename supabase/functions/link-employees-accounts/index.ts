import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const PASSWORD_LENGTH = 20;

function generateTemporaryPassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  const bytes = new Uint8Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  let password = "";
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }
  return "Kf9!" + password.slice(4);
}

function generatedUsername() {
  return "emp" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
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

    const body = await req.json().catch(() => ({}));
    const organizationId = String(body?.organizationId ?? "").trim();
    if (!organizationId) {
      return json({ error: "معرف الجمعية مطلوب" }, 400);
    }

    const callerId = callerData.user.id;
    const { data: isSuper } = await admin.rpc("is_super_admin", {
      _user_id: callerId,
    });

    let allowed = isSuper === true;
    if (!allowed) {
      const [{ data: membership }, { data: scopedAdmin }] =
        await Promise.all([
          admin
            .from("user_organizations")
            .select("id")
            .eq("user_id", callerId)
            .eq("organization_id", organizationId)
            .eq("approval_status", "approved")
            .maybeSingle(),
          admin
            .from("user_roles")
            .select("id")
            .eq("user_id", callerId)
            .eq("organization_id", organizationId)
            .eq("role", "admin")
            .maybeSingle(),
        ]);
      allowed = !!membership && !!scopedAdmin;
    }

    if (!allowed) {
      return json(
        { error: "ليس لديك صلاحية لإدارة حسابات هذه الجمعية" },
        403,
      );
    }

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id, is_active")
      .eq("id", organizationId)
      .maybeSingle();

    if (organizationError || !organization) {
      return json({ error: "الجمعية غير موجودة" }, 404);
    }
    if (!organization.is_active) {
      return json({ error: "الجمعية موقوفة حالياً" }, 409);
    }

    const { data: employees, error: employeesError } = await admin
      .from("employees")
      .select("id, full_name, email, phone, job_role, username")
      .eq("organization_id", organizationId)
      .is("user_id", null)
      .eq("status", "active");

    if (employeesError) {
      console.error("link-employees-accounts fetch failed", {
        code: employeesError.code,
      });
      return json({ error: "خطأ في جلب الموظفين" }, 500);
    }

    if (!employees?.length) {
      return json({
        success: true,
        message: "جميع موظفي الجمعية لديهم حسابات بالفعل",
        created: 0,
        failed: 0,
        accounts: [],
        errors: [],
      });
    }

    const results: {
      success: {
        name: string;
        username: string;
        password: string;
      }[];
      failed: {
        name: string;
        reason: string;
      }[];
    } = { success: [], failed: [] };

    for (const employee of employees) {
      const username = String(
        employee.username || generatedUsername(),
      ).trim();
      const cleanUsername = username
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

      if (!cleanUsername) {
        results.failed.push({
          name: employee.full_name,
          reason: "اسم المستخدم غير صالح",
        });
        continue;
      }

      const internalEmail = `${cleanUsername}@user.local`;
      const temporaryPassword = generateTemporaryPassword();

      let authUserId: string | null = null;
      let membershipCreated = false;
      let employeeLinked = false;

      const rollback = async () => {
        if (authUserId) {
          await admin
            .from("user_roles")
            .delete()
            .eq("user_id", authUserId)
            .then(() => {}, () => {});

          if (membershipCreated) {
            await admin
              .from("user_organizations")
              .delete()
              .eq("user_id", authUserId)
              .eq("organization_id", organizationId)
              .then(() => {}, () => {});
          }

          if (employeeLinked) {
            await admin
              .from("employees")
              .update({ user_id: null })
              .eq("id", employee.id)
              .eq("organization_id", organizationId)
              .then(() => {}, () => {});
          }

          await admin.auth.admin
            .deleteUser(authUserId)
            .then(() => {}, () => {});
        }
      };

      try {
        const { data: authData, error: authError } =
          await admin.auth.admin.createUser({
            email: internalEmail,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              full_name: employee.full_name,
              username,
              phone: employee.phone || null,
              email: employee.email || null,
              organization_id: organizationId,
              must_change_password: true,
            },
          });

        if (authError || !authData?.user) {
          results.failed.push({
            name: employee.full_name,
            reason:
              authError?.message?.includes("already")
                ? "اسم المستخدم مرتبط بحساب موجود"
                : "فشل إنشاء حساب الدخول",
          });
          continue;
        }

        authUserId = authData.user.id;

        const { error: updateEmployeeError } = await admin
          .from("employees")
          .update({
            user_id: authUserId,
            username,
          })
          .eq("id", employee.id)
          .eq("organization_id", organizationId);

        if (updateEmployeeError) {
          throw updateEmployeeError;
        }
        employeeLinked = true;

        const { error: membershipError } = await admin
          .from("user_organizations")
          .insert({
            user_id: authUserId,
            organization_id: organizationId,
            is_default: true,
            approval_status: "approved",
            requested_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            approved_by: callerId,
          });

        if (membershipError) {
          throw membershipError;
        }
        membershipCreated = true;

        const { error: roleError } = await admin
          .from("user_roles")
          .insert({
            user_id: authUserId,
            role: "user",
            organization_id: null,
          });

        if (roleError) {
          throw roleError;
        }

        results.success.push({
          name: employee.full_name,
          username,
          password: temporaryPassword,
        });
      } catch (error) {
        console.error("link-employees-accounts rollback", {
          message: error instanceof Error ? error.message : "unknown",
        });
        await rollback();
        results.failed.push({
          name: employee.full_name,
          reason: "تعذر إكمال ربط الحساب وتم التراجع تلقائياً",
        });
      }
    }

    return json({
      success: true,
      message: `تم إنشاء ${results.success.length} حساب بنجاح`,
      created: results.success.length,
      failed: results.failed.length,
      accounts: results.success,
      errors: results.failed,
    });
  } catch (error) {
    console.error("link-employees-accounts failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});
