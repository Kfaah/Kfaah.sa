import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "غير مصرح" }, 401);
    }

    const token = authHeader.slice(7).trim();
    const { data: userData, error: userError } =
      await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ success: false, error: "غير مصرح" }, 401);
    }
    const senderUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const taskId = body?.taskId as string | undefined;
    const recipientId = body?.recipientId as string | undefined;

    if (!taskId || !recipientId) {
      return json(
        {
          success: false,
          error: "معرف المهمة والمستلم مطلوبان",
        },
        400,
      );
    }

    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select("id, user_id, title, organization_id")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) {
      console.error("Task fetch error:", taskError);
      return json(
        { success: false, error: "فشل في جلب بيانات المهمة" },
        500,
      );
    }
    if (!task?.organization_id) {
      return json(
        { success: false, error: "المهمة غير موجودة" },
        404,
      );
    }

    const organizationId = task.organization_id;

    const [
      { data: senderRoles },
      { data: senderMembership },
      { data: recipientRoles },
      { data: recipientMembership },
    ] = await Promise.all([
      admin
        .from("user_roles")
        .select("role, organization_id")
        .eq("user_id", senderUserId),
      admin
        .from("user_organizations")
        .select("id")
        .eq("user_id", senderUserId)
        .eq("organization_id", organizationId)
        .eq("approval_status", "approved")
        .maybeSingle(),
      admin
        .from("user_roles")
        .select("role, organization_id")
        .eq("user_id", recipientId),
      admin
        .from("user_organizations")
        .select("id")
        .eq("user_id", recipientId)
        .eq("organization_id", organizationId)
        .eq("approval_status", "approved")
        .maybeSingle(),
    ]);

    const senderIsSuper = (senderRoles ?? []).some(
      (r) => r.role === "super_admin",
    );
    const senderIsOrgAdmin = (senderRoles ?? []).some(
      (r) =>
        r.role === "admin" &&
        r.organization_id === organizationId,
    );

    const senderIsAdmin =
      senderIsSuper ||
      (senderIsOrgAdmin && Boolean(senderMembership));

    // Platform super admins may inspect/support any organization. Everyone
    // else must be an approved member of the task's organization.
    if (!senderIsSuper && !senderMembership) {
      return json(
        { success: false, error: "لا يمكنك الوصول لهذه المهمة" },
        403,
      );
    }

    if (senderIsAdmin) {
      // An admin may notify only the task owner, never an arbitrary account.
      if (recipientId !== task.user_id || !recipientMembership) {
        return json(
          {
            success: false,
            error: "لا يمكنك إرسال إشعار لغير صاحب المهمة",
          },
          403,
        );
      }
    } else {
      // An employee may notify only an admin of the same organization.
      if (senderUserId !== task.user_id) {
        return json(
          {
            success: false,
            error: "لا يمكنك إرسال إشعار لهذه المهمة",
          },
          403,
        );
      }

      const recipientIsOrgAdmin =
        Boolean(recipientMembership) &&
        (recipientRoles ?? []).some(
          (r) =>
            r.role === "admin" &&
            r.organization_id === organizationId,
        );

      if (!recipientIsOrgAdmin) {
        return json(
          {
            success: false,
            error: "المستلم ليس مديراً لهذه الجمعية",
          },
          400,
        );
      }
    }

    const title = senderIsAdmin
      ? "رسالة جديدة"
      : "رسالة جديدة من موظف";

    const { error: insertError } = await admin
      .from("notifications")
      .insert({
        user_id: recipientId,
        organization_id: organizationId,
        title,
        message: `لديك رسالة جديدة في مهمة "${task.title || "مهمة"}"`,
        type: "message",
        related_task_id: taskId,
      });

    if (insertError) {
      console.error("Notification insert error:", insertError);
      return json(
        { success: false, error: "فشل إرسال الإشعار" },
        500,
      );
    }

    return json({ success: true });
  } catch (error) {
    console.error("notify-task-message error:", error);
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ غير متوقع",
      },
      500,
    );
  }
});
