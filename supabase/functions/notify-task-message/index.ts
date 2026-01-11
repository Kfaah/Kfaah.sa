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
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "غير مصرح" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Claims error:", claimsError);
      return json({ success: false, error: "غير مصرح" }, 401);
    }

    const senderUserId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const taskId = body?.taskId as string | undefined;
    const recipientId = body?.recipientId as string | undefined;
    const taskTitle = (body?.taskTitle as string | undefined) || undefined;

    if (!taskId || !recipientId) {
      return json(
        { success: false, error: "معرف المهمة والمستلم مطلوبان" },
        400,
      );
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("id, user_id, title")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) {
      console.error("Task fetch error:", taskError);
      return json({ success: false, error: "فشل في جلب بيانات المهمة" }, 500);
    }

    if (!task) {
      return json({ success: false, error: "المهمة غير موجودة" }, 404);
    }

    const { data: senderIsAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: senderUserId,
      _role: "admin",
    });

    const isAdmin = senderIsAdmin === true;

    // قواعد التحقق:
    // - إذا المرسل مدير: فقط يرسل لصاحب المهمة
    // - إذا المرسل موظف: يجب أن يكون هو صاحب المهمة، والمستلم يجب أن يكون مدير
    if (isAdmin) {
      if (recipientId !== task.user_id) {
        return json(
          { success: false, error: "لا يمكنك إرسال إشعار لغير صاحب المهمة" },
          403,
        );
      }
    } else {
      if (senderUserId !== task.user_id) {
        return json(
          { success: false, error: "لا يمكنك إرسال إشعار لهذه المهمة" },
          403,
        );
      }

      const { data: recipientIsAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: recipientId,
        _role: "admin",
      });

      if (recipientIsAdmin !== true) {
        return json(
          { success: false, error: "المستلم المحدد ليس مدير نظام" },
          400,
        );
      }
    }

    const title = isAdmin ? "رسالة جديدة" : "رسالة جديدة من موظف";
    const msgTaskTitle = taskTitle || task.title || "مهمة";

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: recipientId,
        title,
        message: `لديك رسالة جديدة في مهمة "${msgTaskTitle}"`,
        type: "message",
        related_task_id: taskId,
      });

    if (insertError) {
      console.error("Notification insert error:", insertError);
      return json({ success: false, error: "فشل إرسال الإشعار" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("notify-task-message error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
      },
      500,
    );
  }
});
