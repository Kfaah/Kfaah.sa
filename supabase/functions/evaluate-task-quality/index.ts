import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { taskId } = await req.json();
    if (!taskId || typeof taskId !== "string") {
      return new Response(JSON.stringify({ error: "taskId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: task, error: tErr } = await admin
      .from("tasks")
      .select("id, title, description, status, due_date, priority, category, completion_percentage, quality_percentage, estimated_time_minutes, actual_time_minutes, started_at, updated_at, user_id, organization_id")
      .eq("id", taskId)
      .maybeSingle();
    if (tErr || !task) {
      return new Response(JSON.stringify({ error: "task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.status !== "completed" && task.status !== "executed") {
      return new Response(
        JSON.stringify({ error: "task is not completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = `قيّم جودة إنجاز هذه المهمة من 0 إلى 100.

- العنوان: ${task.title}
- الوصف: ${task.description ?? "—"}
- الفئة: ${task.category ?? "—"}
- الأولوية: ${task.priority}
- نسبة الإكمال (المُسجّلة): ${task.completion_percentage ?? 0}%
- جودة ذاتية مُسجّلة: ${task.quality_percentage ?? "—"}
- الوقت المقدّر (دقائق): ${task.estimated_time_minutes ?? "—"}
- الوقت الفعلي (دقائق): ${task.actual_time_minutes ?? "—"}
- موعد التسليم: ${task.due_date ?? "—"}
- آخر تحديث: ${task.updated_at}

أعطِ تقييماً موضوعياً مع نقاط القوة والتحسين.`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "أنت مُقيِّم أداء محايد. أرجع تقييماً منظماً عبر استدعاء الأداة فقط.",
            },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "submit_evaluation",
                description: "Return a structured task quality evaluation.",
                parameters: {
                  type: "object",
                  properties: {
                    quality_score: {
                      type: "number",
                      description: "0-100 overall quality of completion",
                    },
                    summary: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    improvements: { type: "array", items: { type: "string" } },
                  },
                  required: ["quality_score", "summary", "strengths", "improvements"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "submit_evaluation" },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI eval error:", aiRes.status, txt);
      return new Response(
        JSON.stringify({ error: "AI evaluation failed", status: aiRes.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!args) {
      return new Response(JSON.stringify({ error: "no evaluation returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const score = Math.max(0, Math.min(100, Number(args.quality_score)));

    const { error: upErr } = await admin
      .from("task_quality_evaluations")
      .upsert(
        {
          task_id: task.id,
          user_id: task.user_id,
          organization_id: task.organization_id,
          quality_score: score,
          summary: args.summary,
          strengths: args.strengths ?? [],
          improvements: args.improvements ?? [],
          ai_model: "google/gemini-3-flash-preview",
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: "task_id" },
      );

    if (upErr) {
      console.error("upsert error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, quality_score: score }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});