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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body = await req.json().catch(() => null) as
      | { slug?: string; username?: string; password?: string; first_name?: string; last_name?: string }
      | null;

    const slug = (body?.slug || "").trim();
    const username = (body?.username || "").trim();
    const password = body?.password || "";
    const firstName = (body?.first_name || "").trim();
    const lastName = (body?.last_name || "").trim();

    if (!slug || !username || password.length < 6) {
      return json({ error: "بيانات التسجيل غير مكتملة" }, 400);
    }

    const cleaned = username.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (!cleaned) return json({ error: "رقم الهوية غير صالح" }, 400);
    const email = `${cleaned}@user.local`;

    // Organization must exist, be active and allow self signup
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .select("id, slug, is_active, allow_self_signup")
      .eq("slug", slug)
      .maybeSingle();
    if (orgErr) return json({ error: orgErr.message }, 500);
    if (!org || !org.is_active || !org.allow_self_signup) {
      return json({ error: "التسجيل الذاتي غير متاح لهذه الجمعية" }, 400);
    }

    // Create the auth user (already confirmed: internal @user.local identities)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: [firstName, lastName].filter(Boolean).join(" "),
        username,
      },
    });

    let userId = created?.user?.id ?? null;

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!alreadyExists) return json({ error: createErr.message }, 400);

      // Existing account: find it, and only attach a pending request for this org
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users?.find((u) => u.email === email)?.id ?? null;
      if (!userId) return json({ error: "رقم الهوية مستخدم مسبقاً" }, 400);

      const { data: existingMembership } = await admin
        .from("user_organizations")
        .select("approval_status")
        .eq("user_id", userId)
        .eq("organization_id", org.id)
        .maybeSingle();
      if (existingMembership) {
        return json({
          success: true,
          status: existingMembership.approval_status,
          message: "لديك طلب/عضوية بالفعل في هذه الجمعية",
        });
      }
    }

    if (!userId) return json({ error: "تعذر إنشاء الحساب" }, 500);

    const { error: memberErr } = await admin
      .from("user_organizations")
      .upsert(
        {
          user_id: userId,
          organization_id: org.id,
          is_default: true,
          approval_status: "pending",
          requested_at: new Date().toISOString(),
          approved_by: null,
          approved_at: null,
        },
        { onConflict: "user_id,organization_id" },
      );
    if (memberErr) return json({ error: memberErr.message }, 500);

    await admin.from("user_roles").insert({ user_id: userId, role: "user" });

    return json({ success: true, status: "pending" });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error)?.message || "حدث خطأ غير متوقع" }, 500);
  }
});
