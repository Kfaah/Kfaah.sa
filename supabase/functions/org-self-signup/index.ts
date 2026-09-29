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


async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clientAddress(req: Request): string | null {
  const direct =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "إعدادات الخادم غير مكتملة" }, 500);
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const publicAuth = createClient(
      supabaseUrl,
      anonKey,
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

    if (!slug || !username || password.length < 8) {
      return json({ error: "بيانات التسجيل غير مكتملة أو كلمة المرور قصيرة" }, 400);
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

    // Atomic abuse controls. The database stores only SHA-256 digests, never
    // the raw username or client address.
    const orgKey = await sha256Hex(`signup:org:${org.id}`);
    const identityKey = await sha256Hex(`signup:identity:${org.id}:${cleaned}`);
    const source = clientAddress(req);
    const sourceKey = source
      ? await sha256Hex(`signup:source:${org.id}:${source}`)
      : null;

    const { data: orgAllowed, error: orgLimitError } =
      await admin.rpc("consume_public_rate_limit", {
        _scope: "org_self_signup_org",
        _key_hash: orgKey,
        _max_attempts: 100,
        _window_seconds: 900,
      });

    if (orgLimitError) {
      console.error("signup organization rate-limit failed", {
        code: orgLimitError.code,
      });
      return json({ error: "تعذر التحقق من معدل الطلبات" }, 503);
    }

    if (orgAllowed !== true) {
      return json(
        { error: "تم بلوغ الحد المؤقت لطلبات التسجيل في هذه الجمعية. أعد المحاولة لاحقاً." },
        429,
      );
    }

    const { data: identityAllowed, error: identityLimitError } =
      await admin.rpc("consume_public_rate_limit", {
        _scope: "org_self_signup_identity",
        _key_hash: identityKey,
        _max_attempts: 8,
        _window_seconds: 900,
      });

    if (identityLimitError) {
      console.error("signup identity rate-limit failed", {
        code: identityLimitError.code,
      });
      return json({ error: "تعذر التحقق من معدل الطلبات" }, 503);
    }

    if (identityAllowed !== true) {
      return json(
        { error: "محاولات كثيرة لهذا الحساب. أعد المحاولة لاحقاً." },
        429,
      );
    }

    if (sourceKey) {
      const { data: sourceAllowed, error: sourceLimitError } =
        await admin.rpc("consume_public_rate_limit", {
          _scope: "org_self_signup_source",
          _key_hash: sourceKey,
          _max_attempts: 40,
          _window_seconds: 900,
        });

      if (sourceLimitError) {
        console.error("signup source rate-limit failed", {
          code: sourceLimitError.code,
        });
        return json({ error: "تعذر التحقق من معدل الطلبات" }, 503);
      }

      if (sourceAllowed !== true) {
        return json(
          { error: "طلبات تسجيل كثيرة من هذا المصدر. أعد المحاولة لاحقاً." },
          429,
        );
      }
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
    const createdNewUser = !createErr && !!created?.user;

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!alreadyExists) return json({ error: createErr.message }, 400);

      // Existing identities must prove ownership before a new organization
      // membership request can be attached to their account.
      const { data: signInData, error: signInError } =
        await publicAuth.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.user?.id) {
        return json(
          { error: "الحساب موجود، وكلمة المرور المدخلة غير صحيحة" },
          401,
        );
      }

      userId = signInData.user.id;

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
          is_default: false,
          approval_status: "pending",
          requested_at: new Date().toISOString(),
          approved_by: null,
          approved_at: null,
        },
        { onConflict: "user_id,organization_id" },
      );
    if (memberErr) {
      if (createdNewUser) {
        await admin.auth.admin.deleteUser(userId).then(() => {}, () => {});
      }
      return json({ error: "تعذر إرسال طلب الانضمام" }, 500);
    }

    // The user role is granted only after an administrator approves the
    // membership request in review_membership_request.
    return json({ success: true, status: "pending" });
  } catch (e) {
    console.error("org-self-signup failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});
