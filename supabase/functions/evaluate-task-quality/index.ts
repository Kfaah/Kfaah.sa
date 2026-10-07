import { withRulesMode } from "../_shared/rule-mode.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(withRulesMode("evaluate-task-quality", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!KFAAH_AI_API_KEY) {
      return new Response(JSON.stringify({ error: "KFAAH_AI_API_KEY missing" }), {
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
      .select("id, title, description, status, due_date, priority, category, source, metadata, completion_percentage, quality_percentage, estimated_time_minutes, actual_time_minutes, started_at, updated_at, user_id, organization_id")
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

    // ---- Compute expected vs actual minutes from learned baselines ----
    let actualMin = Number(task.actual_time_minutes) || 0;
    if ((!actualMin || actualMin <= 0) && task.started_at) {
      const startedTs = new Date(task.started_at).getTime();
      const updatedTs = new Date(task.updated_at).getTime();
      if (Number.isFinite(startedTs) && Number.isFinite(updatedTs) && updatedTs > startedTs) {
        actualMin = (updatedTs - startedTs) / 60000;
      }
    }

    const channel = (task as any)?.metadata?.channel ?? null;
    const baselineKeys: string[] = [];
    if (task.source) baselineKeys.push(`source:${task.source}`);
    if (task.category) baselineKeys.push(`category:${task.category}`);
    if (channel) baselineKeys.push(`channel:${channel}`);

    let expectedMin = Number(task.estimated_time_minutes) || 0;
    let baselineSource = "estimated";
    if (baselineKeys.length && task.organization_id) {
      const { data: bl } = await admin
        .from("task_time_baselines")
        .select("baseline_key, avg_minutes, samples")
        .eq("organization_id", task.organization_id)
        .in("baseline_key", baselineKeys);
      if (bl && bl.length) {
        // weighted avg by samples
        const tot = bl.reduce((a: number, r: any) => a + (Number(r.samples) || 1), 0);
        const w = bl.reduce(
          (a: number, r: any) => a + (Number(r.avg_minutes) || 0) * (Number(r.samples) || 1),
          0,
        );
        if (tot > 0) {
          expectedMin = Math.max(3, Math.min(240, w / tot));
          baselineSource = "learned";
        }
      }
    }
    if (!expectedMin || expectedMin <= 0) expectedMin = 15;

    const ratio = actualMin > 0 ? actualMin / expectedMin : null;
    // Efficiency curve: =1.0 → 100, ≤0.6 → 100, 1.5 → 70, 2.0 → 50, 3.0 → 25, ≥4 → 10
    function efficiencyFromRatio(r: number | null): number {
      if (r == null) return 70;
      if (r <= 1.0) return 100;
      if (r <= 1.25) return 90;
      if (r <= 1.5) return 75;
      if (r <= 2.0) return 55;
      if (r <= 3.0) return 30;
      return 12;
    }
    const timeEfficiency = efficiencyFromRatio(ratio);

    const userPrompt = `قيّم جودة إنجاز هذه المهمة من 0 إلى 100.

- العنوان: ${task.title}
- الوصف: ${task.description ?? "—"}
- الفئة: ${task.category ?? "—"}
- الأولوية: ${task.priority}
- نسبة الإكمال (المُسجّلة): ${task.completion_percentage ?? 0}%
- جودة ذاتية مُسجّلة: ${task.quality_percentage ?? "—"}
- الوقت المتوقع وفق التعلّم (دقائق): ${expectedMin.toFixed(1)} (${baselineSource})
- الوقت الفعلي (دقائق): ${actualMin ? actualMin.toFixed(1) : "—"}
- نسبة الفعلي/المتوقع: ${ratio ? ratio.toFixed(2) : "—"}
- درجة كفاءة الوقت المُحتسبة: ${timeEfficiency}/100
- موعد التسليم: ${task.due_date ?? "—"}
- آخر تحديث: ${task.updated_at}

أعطِ تقييماً موضوعياً للجودة. **اخفِض درجة الجودة بشكل ملموس إذا تجاوز الوقت الفعلي ضعف المتوقع، أو إذا بدا الموظف يتباطأ بلا مبرر.** اذكر صراحةً ملاحظة عن استثمار الوقت.`;

    const aiRes = await fetch(
      (Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KFAAH_AI_API_KEY}`,
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
                    efficiency_notes: {
                      type: "string",
                      description: "ملاحظة قصيرة عن استثمار الوقت ومدى تناسبه مع طبيعة المهمة.",
                    },
                  },
                  required: ["quality_score", "summary", "strengths", "improvements", "efficiency_notes"],
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
          time_efficiency_score: timeEfficiency,
          expected_minutes: expectedMin,
          actual_minutes: actualMin || null,
          time_ratio: ratio,
          efficiency_notes: args.efficiency_notes ?? null,
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
      JSON.stringify({
        ok: true,
        quality_score: score,
        time_efficiency_score: timeEfficiency,
        expected_minutes: expectedMin,
        actual_minutes: actualMin || null,
        time_ratio: ratio,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}));
