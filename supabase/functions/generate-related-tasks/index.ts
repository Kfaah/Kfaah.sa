import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { executive_plan_id } = await req.json();
    if (!executive_plan_id) {
      return new Response(JSON.stringify({ error: "executive_plan_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch executive plan + operational plan + responsible employee
    const { data: ep, error: epErr } = await admin
      .from("executive_plans")
      .select(
        "id, day, organization_id, operational_plan_month_id, operational_plan_months!inner(month, operational_plan_id, operational_plans!inner(id, activity_name, strategic_goal, initiative, sub_initiative, responsible_employee_id, year))"
      )
      .eq("id", executive_plan_id)
      .maybeSingle();
    if (epErr || !ep) throw new Error(epErr?.message || "Executive plan not found");

    const opm: any = (ep as any).operational_plan_months;
    const op: any = opm?.operational_plans;
    const responsibleEmpId: string | null = op?.responsible_employee_id ?? null;

    // Fetch all employees in this org with departments for AI context
    const { data: employees } = await admin
      .from("employees")
      .select("id, full_name, job_title, department_id, departments(name)")
      .eq("organization_id", ep.organization_id);

    // Already-defined related employees for this activity
    const { data: relatedEmps } = await admin
      .from("activity_related_employees")
      .select("employee_id, role_in_activity")
      .eq("executive_plan_id", executive_plan_id);

    const targetEmpIds = new Set<string>();
    if (responsibleEmpId) targetEmpIds.add(responsibleEmpId);
    (relatedEmps ?? []).forEach((r: any) => targetEmpIds.add(r.employee_id));

    // Build prompt context
    const empById = new Map<string, any>((employees ?? []).map((e: any) => [e.id, e]));
    const targetList = Array.from(targetEmpIds)
      .map((id) => empById.get(id))
      .filter(Boolean)
      .map((e: any) => ({
        employee_id: e.id,
        full_name: e.full_name,
        job_title: e.job_title,
        department: e.departments?.name ?? null,
      }));

    if (targetList.length === 0) {
      return new Response(
        JSON.stringify({ error: "لا يوجد موظفون مرتبطون بهذا النشاط" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allOrgEmployees = (employees ?? []).map((e: any) => ({
      employee_id: e.id,
      full_name: e.full_name,
      job_title: e.job_title,
      department: e.departments?.name ?? null,
    }));

    const systemPrompt = `أنت مدير تنفيذي خبير في إدارة المشاريع والجمعيات الخيرية. مهمتك توليد قائمة احترافية ودقيقة من المهام التحضيرية (قبل) والتنفيذية (أثناء) والختامية (بعد) لنشاط محدد، موزعة على الموظفين المعنيين كلٌّ حسب دوره.

قواعد صارمة:
- ولّد بين 3-8 مهام لكل موظف، موزعة بذكاء بين قبل/أثناء/بعد حسب طبيعة دوره.
- كل مهمة عملية وقابلة للقياس (لا عموميات).
- المدة التقديرية واقعية بالدقائق (15-240).
- الأولوية: high للحرجة، medium للأساسية، low للداعمة.
- day_offset: عدد الأيام قبل (سالب) أو بعد (موجب) يوم النشاط، 0 لنفس اليوم. مثال: مهمة "تنسيق مع الإمام قبل المحاضرة بأسبوع" → day_offset = -7.
- إن كان هناك موظفون آخرون في الجمعية لم يُضافوا لكنهم مرشحون منطقياً (مثل الإعلام، المالية، التوثيق)، اقترحهم في suggested_related_employees مع سبب واضح.`;

    const userPrompt = `النشاط: "${op.activity_name}"
الهدف الاستراتيجي: ${op.strategic_goal ?? "غير محدد"}
المبادرة: ${op.initiative ?? "غير محدد"}
المبادرة الفرعية: ${op.sub_initiative ?? "غير محدد"}
يوم التنفيذ: اليوم ${ep.day} من الشهر ${opm.month}/${op.year}

الموظفون المعنيون حالياً:
${JSON.stringify(targetList, null, 2)}

جميع موظفي الجمعية (لاقتراح موظفين إضافيين ذوي علاقة):
${JSON.stringify(allOrgEmployees, null, 2)}

ولّد المهام الآن.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_related_tasks",
              description: "Submit generated tasks (before/during/after) per employee + suggested related employees.",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        employee_id: { type: "string" },
                        phase: { type: "string", enum: ["before", "during", "after"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        estimated_minutes: { type: "integer" },
                        priority: { type: "string", enum: ["low", "medium", "high"] },
                        day_offset: { type: "integer" },
                      },
                      required: ["employee_id", "phase", "title", "estimated_minutes", "priority", "day_offset"],
                      additionalProperties: false,
                    },
                  },
                  suggested_related_employees: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        employee_id: { type: "string" },
                        role_in_activity: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["employee_id", "role_in_activity"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks", "suggested_related_employees"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_related_tasks" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429)
        return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (aiResp.status === 402)
        return new Response(JSON.stringify({ error: "نفدت أرصدة الذكاء الاصطناعي، يرجى الإضافة" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      throw new Error("AI gateway failed");
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { tasks: [], suggested_related_employees: [] };

    // Insert generated tasks (replace existing AI-generated, keep manual)
    await admin
      .from("activity_related_tasks")
      .delete()
      .eq("executive_plan_id", executive_plan_id)
      .eq("source", "ai")
      .eq("is_dispatched", false);

    const rows = (args.tasks ?? [])
      .filter((t: any) => empById.has(t.employee_id))
      .map((t: any, i: number) => ({
        executive_plan_id,
        employee_id: t.employee_id,
        phase: t.phase,
        title: t.title,
        description: t.description ?? null,
        estimated_minutes: t.estimated_minutes ?? 30,
        priority: t.priority ?? "medium",
        day_offset: t.day_offset ?? 0,
        display_order: i,
        source: "ai",
        organization_id: ep.organization_id,
      }));

    if (rows.length > 0) {
      const { error: insErr } = await admin.from("activity_related_tasks").insert(rows);
      if (insErr) throw insErr;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        generated_count: rows.length,
        suggested_related_employees: (args.suggested_related_employees ?? []).filter((s: any) => empById.has(s.employee_id)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-related-tasks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});