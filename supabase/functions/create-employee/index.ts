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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the requesting user using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Claims error:", claimsError);
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestingUserId = claimsData.claims.sub as string;

    // Check if requesting user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: requestingUserId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "ليس لديك صلاحية لإضافة موظفين" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    
    // Handle password update action
    if (body.action === "update-password") {
      const { userId, password } = body;

      if (!userId || !password) {
        return json({ success: false, error: "معرف المستخدم وكلمة المرور مطلوبان" }, 400);
      }

      if (password.length < 6) {
        return json({ success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, 400);
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (updateError) {
        console.error("Error updating password:", updateError);
        return json({ success: false, error: "حدث خطأ أثناء تحديث كلمة المرور" }, 500);
      }

      return json({ success: true, message: "تم تحديث كلمة المرور بنجاح" }, 200);
    }

    // Keep Auth login (internal email) synced with the employee username
    if (body.action === "sync-login") {
      const { userId, username } = body;

      if (!userId || !username?.trim()) {
        return json({ success: false, error: "معرف المستخدم ورقم الهوية مطلوبان" }, 400);
      }

      const cleanUsername = String(username).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (!cleanUsername) {
        return json({ success: false, error: "رقم الهوية غير صالح" }, 400);
      }

      const internalEmail = `${cleanUsername}@user.local`;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: internalEmail,
        email_confirm: true,
        user_metadata: {
          username: username,
        },
      });

      if (updateError) {
        console.error("Error syncing login email:", updateError);
        const msg = updateError.message?.includes("already been registered")
          ? "رقم الهوية مرتبط بحساب آخر"
          : "حدث خطأ أثناء ربط بيانات الدخول";
        return json({ success: false, error: msg }, 500);
      }

      return json({ success: true, message: "تم ربط بيانات الدخول بنجاح", loginEmail: internalEmail }, 200);
    }
    const { fullName, username, password, email, phone, jobRole, roleColor, avatarUrl, directManagerId, executiveManagerId, roleLevel } = body;

    // Validate required fields
    const fieldErrors: Record<string, string> = {};

    if (!fullName?.trim()) fieldErrors.name = "الاسم الكامل مطلوب";
    if (!username?.trim()) fieldErrors.username = "رقم الهوية مطلوب";
    if (!password) fieldErrors.password = "كلمة المرور مطلوبة";
    if (!email?.trim()) fieldErrors.email = "البريد الإلكتروني مطلوب";
    if (!phone?.trim()) fieldErrors.phone = "رقم الجوال مطلوب";
    if (!jobRole?.trim()) fieldErrors.role = "الدور الوظيفي مطلوب";

    if (Object.keys(fieldErrors).length > 0) {
      return json({ success: false, fieldErrors }, 200);
    }

    if (password.length < 6) {
      return json(
        { success: false, fieldErrors: { password: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" } },
        200
      );
    }

    // Check for duplicate username (ID)
    const { data: existingUsername } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingUsername) {
      return json(
        { success: false, fieldErrors: { username: "رقم الهوية مسجل مسبقاً" } },
        200
      );
    }

    // Check for duplicate email
    const { data: existingEmail } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingEmail) {
      return json(
        { success: false, fieldErrors: { email: "البريد الإلكتروني مسجل مسبقاً" } },
        200
      );
    }

    // Check for duplicate phone
    const { data: existingPhone } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingPhone) {
      return json(
        { success: false, fieldErrors: { phone: "رقم الجوال مسجل مسبقاً" } },
        200
      );
    }

    // Convert username to internal email format for Supabase Auth
    // This allows any username format (phone, email, ID, etc.)
    const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const internalEmail = `${cleanUsername}@user.local`;

    // Create user in Supabase Auth
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        username: username, // Store original username
        phone: phone || null,
        email: email || null,
      },
    });

    if (createUserError) {
      console.error("Error creating user:", createUserError);

      // internalEmail is derived from username, so this mostly indicates a duplicate ID
      if (createUserError.message.includes("already been registered")) {
        return json(
          { success: false, fieldErrors: { username: "رقم الهوية مسجل مسبقاً" } },
          200
        );
      }

      return json({ success: false, error: "حدث خطأ أثناء إنشاء الحساب" }, 500);
    }

    // Create employee record
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        username: username,
        email: email || null,
        phone: phone || null,
        job_role: jobRole,
        role_color: roleColor || "bg-primary",
        avatar_url: avatarUrl || null,
        status: "active",
        direct_manager_id: directManagerId || null,
        executive_manager_id: executiveManagerId || null,
      })
      .select()
      .single();

    if (employeeError) {
      console.error("Error creating employee:", employeeError);
      // If employee creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: "حدث خطأ أثناء إنشاء سجل الموظف" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign 'user' role to the new employee
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "user",
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    }

      return json(
        {
          success: true,
          message: "تم إضافة الموظف بنجاح",
          employee: employee,
        },
        200
      );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});