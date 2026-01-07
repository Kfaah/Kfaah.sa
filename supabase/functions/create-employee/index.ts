import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: requestingUser.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "ليس لديك صلاحية لإضافة موظفين" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee data from request
    const { fullName, email, password, phone, jobRole, roleColor, avatarUrl } = await req.json();

    // Validate required fields
    if (!fullName || !email || !password || !jobRole) {
      return new Response(
        JSON.stringify({ error: "يرجى ملء جميع الحقول المطلوبة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email is a phone number (starts with 0 or +) and convert to email format
    let userEmail = email;
    let userPhone = phone || null;
    
    const isPhoneNumber = /^[\+]?[0-9]{10,15}$/.test(email.replace(/\s/g, ''));
    
    if (isPhoneNumber) {
      // Convert phone to email format for Supabase Auth
      const cleanPhone = email.replace(/\s/g, '').replace('+', '');
      userEmail = `${cleanPhone}@phone.local`;
      userPhone = email; // Store original as phone
    }

    // Create user in Supabase Auth
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        phone: userPhone,
        original_identifier: email, // Store original identifier
      },
    });

    if (createUserError) {
      console.error("Error creating user:", createUserError);
      
      if (createUserError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "البريد الإلكتروني مسجل مسبقاً" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "حدث خطأ أثناء إنشاء الحساب" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create employee record
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        email: email, // Store original identifier (email or phone)
        phone: userPhone,
        job_role: jobRole,
        role_color: roleColor || "bg-primary",
        avatar_url: avatarUrl || null,
        status: "active",
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "تم إضافة الموظف بنجاح",
        employee: employee 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});