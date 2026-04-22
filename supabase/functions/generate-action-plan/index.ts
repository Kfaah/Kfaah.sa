// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates an Action Plan from the latest cached AI insight for an organization.
 * - Uses recommendations as plan tasks.
 * - Asks AI to assign each task to the most suitable employee (by department/role).
 * - Schedules tasks within the requested duration in days.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, supaKey);

    const { organization_id, duration_days = 30, plan_title } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Latest cached AI insight
    const { data: cached } = await admin
      .from("admin_ai_insights_cache")
      .select("id, insight, period_label, generated_at")
      .eq("organization_id", organization_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cached?.insight) {
      return new Response(JSON.stringify({ error: "لم يتم توليد تحليل ذكي بعد لهذه الجمعية" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recs = (cached.insight.recommendations || []) as { title: string; impact: string; action: string }[];
    if (!recs.length) {
      return new Response(JSON.stringify({ error: "لا توجد توصيات في التحليل" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Org employees for AI assignment
    const { data: employees } = await admin
      .from("employees")
      .select("id, full_name, job_role, title, role_level, department_id, departments(name)")
      .eq("organization_id", organization_id)
      .neq("status", "inactive");

    const empList = (employees || []).map((e: any) => ({
      id: e.id,
      name: e.full_name,
      role: e.job_role,
      title: e.title || null,
      department: e.departments?.name || null,
    }));

    // 3) Ask AI to assign + schedule
    let assignments: { recommendation_index: number; employee_id: string | null; reason: string }[] = [];
    if (empList.length > 0) {
      const sysPrompt = `أنت مدير تنفيذي خبير في توزيع المهام على الموظفين بناءً على القسم والدور الوظيفي. اختر لكل توصية الموظف الأنسب من قائمة الموظفين المتاحين، واذكر سببًا موجزًا (جملة واحدة) يربط دور الموظف بطبيعة التوصية. إذا لم يوجد موظف مناسب فعلًا اختر الأقرب من حيث المسؤولية.`;
      const userPrompt = `الموظفون المتاحون:\n${JSON.stringify(empList, null, 2)}\n\nالتوصيات:\n${recs.map((r, i) => `${i}) [${r.impact}] ${r.title} — ${r.action}`).join("\n")}`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0,
          seed: 7,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_assignments",
              description: "Assign each recommendation to the most suitable employee",
              parameters: {
                type: "object",
                properties: {
                  assignments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        recommendation_index: { type: "number" },
                        employee_id: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["recommendation_index", "employee_id", "reason"],
                    },
                  },
                },
                required: ["assignments"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_assignments" } },
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          try { assignments = JSON.parse(args).assignments || []; } catch { /* ignore */ }
        }
      }
    }

    // 4) Create the plan + tasks
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + Number(duration_days));
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);

    const { data: plan, error: planErr } = await admin
      .from("action_plans")
      .insert({
        organization_id,
        title: plan_title || `خطة من التحليل الذكي (${cached.period_label})`,
        description: cached.insight.summary || null,
        source: "ai_insight",
        source_insight_id: cached.id,
        status: "active",
        start_date: isoDate(today),
        end_date: isoDate(endDate),
        progress: 0,
      })
      .select("id")
      .single();
    if (planErr) throw planErr;

    // Schedule tasks evenly across the period, high impact first
    const sorted = recs
      .map((r, i) => ({ ...r, idx: i }))
      .sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.impact] ?? 1) - (order[b.impact] ?? 1);
      });

    const stepDays = Math.max(1, Math.floor(Number(duration_days) / Math.max(sorted.length, 1)));
    const tasksPayload = sorted.map((r, i) => {
      const start = new Date(today);
      start.setDate(start.getDate() + i * stepDays);
      const due = new Date(start);
      due.setDate(due.getDate() + Math.max(stepDays, 3));
      const a = assignments.find(x => x.recommendation_index === r.idx);
      const validEmpId = a && empList.some(e => e.id === a.employee_id) ? a.employee_id : null;
      return {
        action_plan_id: plan.id,
        organization_id,
        title: r.title,
        description: r.action,
        impact: r.impact,
        priority: i,
        status: "pending" as const,
        start_date: isoDate(start),
        due_date: isoDate(due),
        assigned_employee_id: validEmpId,
        ai_suggested_employee_id: validEmpId,
        ai_suggestion_reason: a?.reason || null,
      };
    });

    const { error: tasksErr } = await admin.from("action_plan_tasks").insert(tasksPayload);
    if (tasksErr) throw tasksErr;

    return new Response(JSON.stringify({ plan_id: plan.id, tasks_count: tasksPayload.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-action-plan error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});