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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // التحقق من صلاحية المستخدم
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "غير مصرح" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return json({ error: "غير مصرح" }, 401);
    }

    const requestingUserId = claimsData.claims.sub as string;

    // التحقق من أن المستخدم admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: requestingUserId,
      _role: "admin",
    });

    if (!isAdmin) {
      return json({ error: "ليس لديك صلاحية لتنفيذ هذه العملية" }, 403);
    }

    // جلب الموظفين الذين ليس لديهم user_id
    const { data: employeesWithoutAccounts, error: fetchError } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, email, phone, job_role, username")
      .is("user_id", null)
      .eq("status", "active");

    if (fetchError) {
      console.error("Error fetching employees:", fetchError);
      return json({ error: "خطأ في جلب الموظفين" }, 500);
    }

    if (!employeesWithoutAccounts || employeesWithoutAccounts.length === 0) {
      return json({ success: true, message: "جميع الموظفين لديهم حسابات بالفعل", created: 0 });
    }

    const results: { 
      success: { name: string; username: string; password: string }[]; 
      failed: { name: string; reason: string }[] 
    } = {
      success: [],
      failed: [],
    };

    for (const employee of employeesWithoutAccounts) {
      try {
        // توليد اسم مستخدم وكلمة مرور
        // استخدام رقم الهوية إذا كان موجوداً، وإلا نولّد رقم عشوائي
        const username = employee.username || `emp${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const cleanUsername = String(username).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const internalEmail = `${cleanUsername}@user.local`;
        
        // كلمة مرور افتراضية: 123456
        const defaultPassword = "123456";

        // إنشاء حساب المستخدم
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: internalEmail,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: employee.full_name,
            username: username,
            phone: employee.phone || null,
            email: employee.email || null,
          },
        });

        if (createError) {
          console.error(`Error creating user for ${employee.full_name}:`, createError);
          results.failed.push({ 
            name: employee.full_name, 
            reason: createError.message 
          });
          continue;
        }

        // تحديث الموظف بـ user_id و username
        const { error: updateError } = await supabaseAdmin
          .from("employees")
          .update({ 
            user_id: authData.user.id,
            username: username,
          })
          .eq("id", employee.id);

        if (updateError) {
          console.error(`Error updating employee ${employee.full_name}:`, updateError);
          // حذف المستخدم إذا فشل التحديث
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          results.failed.push({ 
            name: employee.full_name, 
            reason: "فشل في ربط الحساب بالموظف" 
          });
          continue;
        }

        // إضافة صلاحية user
        await supabaseAdmin.from("user_roles").insert({
          user_id: authData.user.id,
          role: "user",
        });

        results.success.push({
          name: employee.full_name,
          username: username,
          password: defaultPassword,
        });

      } catch (err) {
        console.error(`Unexpected error for ${employee.full_name}:`, err);
        results.failed.push({ 
          name: employee.full_name, 
          reason: "خطأ غير متوقع" 
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
    console.error("Error:", error);
    return json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});
