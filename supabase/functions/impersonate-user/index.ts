import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "missing_auth" }, 401);
    }

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "unauthenticated" }, 401);
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is super_admin
    const { data: isSuperData, error: isSuperErr } = await admin.rpc(
      "is_super_admin",
      { _user_id: callerId },
    );
    if (isSuperErr || !isSuperData) {
      return json({ error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const employeeId = body?.employee_id as string | undefined;
    if (!employeeId) {
      return json({ error: "missing_employee_id" }, 400);
    }

    // Look up employee → user_id → email
    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id, user_id, email, full_name")
      .eq("id", employeeId)
      .maybeSingle();
    if (empErr || !emp) {
      return json({ error: "employee_not_found" }, 404);
    }
    if (!emp.user_id) {
      return json({ error: "employee_has_no_account" }, 400);
    }

    // Get auth user email
    const { data: targetUser, error: targetErr } =
      await admin.auth.admin.getUserById(emp.user_id);
    if (targetErr || !targetUser?.user?.email) {
      return json({ error: "target_user_not_found" }, 404);
    }
    const email = targetUser.user.email;

    // Generate magiclink
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (linkErr || !linkData?.properties) {
      return json(
        { error: "link_failed", details: linkErr?.message },
        500,
      );
    }

    // Return the OTP hash so the client can call verifyOtp({ type: 'magiclink', token_hash })
    return json({
      email,
      employee_name: emp.full_name,
      token_hash: linkData.properties.hashed_token,
      action_link: linkData.properties.action_link,
    });
  } catch (e) {
    return json({ error: "internal", details: String(e?.message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}