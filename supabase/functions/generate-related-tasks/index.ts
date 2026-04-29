import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildFallbackArgs({
  activityName,
  targetList,
  overlap,
  existingTitles,
}: {
  activityName: string;
  targetList: Array<{ employee_id: string; full_name?: string; job_title?: string | null; department?: string | null }>;
  overlap: Array<{ employee_id: string; shared_activity?: string; shared_initiative?: string; department?: string | null }>;
  existingTitles: string[];
}) {
  const existing = new Set(existingTitles.map((t) => t.trim()));
  const suggested_related_employees = overlap.slice(0, 4).map((o) => ({
    employee_id: o.employee_id,
    role_in_activity: o.department ? `تنسيق ${o.department}` : "مساندة مرتبطة بالمبادرة",
    reason: o.shared_initiative || o.shared_activity || "تشابه في الخطة التشغيلية",
  }));

  const employees = [
    ...targetList.map((e) => ({ employee_id: e.employee_id, job_title: e.job_title, primary: true })),
    ...suggested_related_employees.map((e) => ({ employee_id: e.employee_id, job_title: e.role_in_activity, primary: false })),
  ];

  const tasks = employees.flatMap((employee) => {
    const roleHint = employee.job_title ? ` حسب دور ${employee.job_title}` : "";
    const items = employee.primary
      ? [
          { phase: "before", title: `راجع متطلبات ${activityName} وجهّز قائمة التنفيذ`, day_offset: -3, estimated_minutes: 45, priority: "high" },
          { phase: "during", title: `نفّذ مسؤوليات ${activityName} وتابع مؤشرات الإنجاز`, day_offset: 0, estimated_minutes: 120, priority: "high" },
          { phase: "after", title: `وثّق نتائج ${activityName} وارفع التقرير الختامي`, day_offset: 1, estimated_minutes: 60, priority: "medium" },
        ]
      : [
          { phase: "before", title: `نسّق المتطلبات المشتركة لنشاط ${activityName}${roleHint}`, day_offset: -2, estimated_minutes: 30, priority: "medium" },
          { phase: "during", title: `ساند تنفيذ ${activityName}${roleHint} وسجّل الملاحظات`, day_offset: 0, estimated_minutes: 60, priority: "medium" },
          { phase: "after", title: `زوّد المسؤول الرئيسي بمخرجات ${activityName}${roleHint}`, day_offset: 1, estimated_minutes: 30, priority: "low" },
        ];
    return items
      .filter((item) => !existing.has(item.title))
      .map((item) => ({
        ...item,
        employee_id: employee.employee_id,
        description: `توليد احتياطي من النظام عند تعذر خدمة الذكاء الاصطناعي لضمان عدم توقف ترحيل المهام.`,
      }));
  });

  return { tasks, suggested_related_employees };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "إعدادات قاعدة البيانات غير مكتملة" }, 500);
    }

    let body: any = {};
    try {
      const txt = await req.text();
      body = txt ? JSON.parse(txt) : {};
    } catch (_) {
      body = {};
    }
    const { executive_plan_id } = body;
    if (!executive_plan_id) {
      return jsonResponse({ error: "executive_plan_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch executive plan + operational plan + responsible employee
    const { data: ep, error: epErr } = await admin
      .from("executive_plans")
      .select(
        "id, day, daily_target, notes, organization_id, operational_plan_month_id, operational_plan_months!inner(month, monthly_target, operational_plan_id, operational_plans!inner(id, activity_name, strategic_goal, initiative, sub_initiative, responsible_employee_id, year, annual_target, plan_name, estimated_budget))"
      )
      .eq("id", executive_plan_id)
      .maybeSingle();
    if (epErr || !ep) throw new Error(epErr?.message || "Executive plan not found");

    const opm: any = (ep as any).operational_plan_months;
    const op: any = opm?.operational_plans;
    const responsibleEmpId: string | null = op?.responsible_employee_id ?? null;
    const orgId: string = (ep as any).organization_id;

    // Fetch all employees in this org with departments + titles for AI context
    const { data: employees } = await admin
      .from("employees")
      .select("id, full_name, job_role, title, department_id, role_level, departments(name)")
      .eq("organization_id", orgId);

    // Fetch other operational plans in the same org/year to detect cross-plan overlap
    // (employees who frequently appear in similar initiatives → likely related)
    const { data: relatedPlans } = await admin
      .from("operational_plans")
      .select("id, activity_name, strategic_goal, initiative, sub_initiative, responsible_employee_id, year")
      .eq("organization_id", orgId)
      .eq("year", op.year)
      .neq("id", op.id)
      .limit(60);

    // Fetch recent tasks history for the responsible employee + same activity
    // to detect collaboration patterns and avoid duplicate task titles
    const { data: pastTasks } = await admin
      .from("tasks")
      .select("title, user_id, executive_plan_id, source_activity_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(120);

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
        job_title: e.title || e.job_role,
        role_level: e.role_level,
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
      job_title: e.title || e.job_role,
      role_level: e.role_level,
      department: e.departments?.name ?? null,
    }));

    // Build cross-plan signal: which employees are responsible for plans
    // sharing strategic_goal / initiative / sub_initiative with the current activity.
    const overlap = (relatedPlans ?? [])
      .filter((p: any) => {
        if (!p.responsible_employee_id) return false;
        const sg = (p.strategic_goal ?? "").trim();
        const ini = (p.initiative ?? "").trim();
        const sub = (p.sub_initiative ?? "").trim();
        return (
          (sg && sg === (op.strategic_goal ?? "").trim()) ||
          (ini && ini === (op.initiative ?? "").trim()) ||
          (sub && sub === (op.sub_initiative ?? "").trim())
        );
      })
      .map((p: any) => {
        const e = empById.get(p.responsible_employee_id);
        return {
          employee_id: p.responsible_employee_id,
          full_name: e?.full_name ?? "",
          department: e?.departments?.name ?? null,
          shared_activity: p.activity_name,
          shared_initiative: p.initiative,
          shared_sub_initiative: p.sub_initiative,
        };
      })
      .filter((x: any) => x.full_name && !targetEmpIds.has(x.employee_id));

    // Existing task titles to avoid duplication
    const existingTitles = (pastTasks ?? [])
      .filter((t: any) => t.source_activity_id === executive_plan_id)
      .map((t: any) => t.title)
      .slice(0, 30);

    const systemPrompt = `أنت مدير تنفيذي خبير وعالٍ الذكاء في إدارة المشاريع والجمعيات الخيرية، تتقن تحليل الخطط التشغيلية واستنتاج التشابكات بين الأقسام والموظفين.

مهمتك:
1) توليد قائمة احترافية ودقيقة جداً من المهام التحضيرية (قبل) والتنفيذية (أثناء) والختامية (بعد) لنشاط محدد، موزعة على الموظفين المعنيين كلٌّ حسب دوره الفعلي ومسماه الوظيفي وقسمه.
2) استنتاج "الموظفين ذوي العلاقة" بشكل ذكي بناءً على:
   - تركيبة الخطة التشغيلية (الهدف الاستراتيجي، المبادرة، المبادرة الفرعية).
   - الموظفون المسؤولون عن خطط أخرى تتقاطع مع هذا النشاط (تشابك المبادرات).
   - طبيعة النشاط ومتطلباته الواضحة من الأقسام (إعلام، مالية، توثيق، لوجستيات، علاقات عامة...).
   - إذا كان النشاط فعالية: غالباً يحتاج (إعلام، تصوير، علاقات عامة، تنظيم).
   - إذا كان النشاط داخلياً (تدريب/اجتماع): قد يحتاج (موارد بشرية، توثيق).
   - إذا كان النشاط ميدانياً: غالباً يحتاج (لوجستيات، مالية، أمن).

قواعد صارمة:
- ولّد بين 3-6 مهام لكل موظف معني (الأساسي + الموجودون مسبقاً + المقترحون الجدد جميعهم في نفس الاستدعاء)، موزعة بذكاء بين قبل/أثناء/بعد حسب طبيعة دوره.
- كل مهمة عملية وقابلة للقياس وذات صياغة احترافية، لا عموميات. ابدأ بفعل أمر واضح.
- المدة التقديرية واقعية بالدقائق (15-240).
- الأولوية: high للحرجة، medium للأساسية، low للداعمة.
- day_offset: عدد الأيام قبل (سالب) أو بعد (موجب) يوم النشاط، 0 لنفس اليوم. أمثلة: تنسيق مسبق → -7 أو -3، تجهيز يوم سابق → -1، تنفيذ → 0، تقرير ختامي → +1 أو +2.
- لا تكرّر مهاماً موجودة سابقاً (سأزوّدك بقائمتها).
- في suggested_related_employees: اختر بدقة 1-4 موظفين فقط، مع تبرير قوي مرتبط بطبيعة النشاط أو بتشابك المبادرات. لا تقترح موظفاً بلا مبرر واضح.
- إن كان أحد الموظفين الموجودين في "overlap_signals" مناسباً، فأعطه أولوية لأنه مثبت بالبيانات.`;

    const userPrompt = `النشاط: "${op.activity_name}"
اسم الخطة: ${op.plan_name ?? "غير محدد"}
الهدف الاستراتيجي: ${op.strategic_goal ?? "غير محدد"}
المبادرة: ${op.initiative ?? "غير محدد"}
المبادرة الفرعية: ${op.sub_initiative ?? "غير محدد"}
المستهدف السنوي: ${op.annual_target ?? "غير محدد"} | الشهري: ${opm.monthly_target ?? "غير محدد"} | اليومي: ${(ep as any).daily_target ?? "غير محدد"}
الميزانية التقديرية: ${op.estimated_budget ?? "غير محددة"}
يوم التنفيذ: اليوم ${ep.day} من الشهر ${opm.month}/${op.year}
ملاحظات النشاط: ${(ep as any).notes ?? "—"}

الموظفون المعنيون حالياً:
${JSON.stringify(targetList, null, 2)}

إشارات تشابك من خطط أخرى في نفس السنة (موظفون مسؤولون عن خطط تشترك في الهدف/المبادرة/الفرعية):
${JSON.stringify(overlap.slice(0, 15), null, 2)}

مهام سبق توليدها لهذا النشاط (لا تكرّرها):
${JSON.stringify(existingTitles, null, 2)}

جميع موظفي الجمعية (لاقتراح موظفين إضافيين ذوي علاقة):
${JSON.stringify(allOrgEmployees, null, 2)}

ولّد المهام والموظفين ذوي العلاقة الآن بدقة عالية.`;

    let args: any = null;
    let usedFallback = false;
    let warning: string | null = null;

    if (LOVABLE_API_KEY) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
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

      if (aiResp.ok) {
        const aiJson = await aiResp.json();
        const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
        try {
          args = toolCall ? JSON.parse(toolCall.function.arguments) : null;
        } catch (parseError) {
          console.error("AI tool arguments parse error", parseError);
        }
      } else {
        const t = await aiResp.text();
        console.error("AI error", aiResp.status, t);
        warning = aiResp.status === 402
          ? "نفدت أرصدة الذكاء الاصطناعي، فتم استخدام توليد احتياطي تلقائي"
          : aiResp.status === 429
            ? "تم تجاوز حد الاستخدام، فتم استخدام توليد احتياطي تلقائي"
            : "تعذّر الاتصال بالذكاء الاصطناعي، فتم استخدام توليد احتياطي تلقائي";
      }
    } else {
      warning = "مفتاح الذكاء الاصطناعي غير مفعّل، فتم استخدام توليد احتياطي تلقائي";
    }

    if (!args?.tasks || !Array.isArray(args.tasks)) {
      usedFallback = true;
      args = buildFallbackArgs({ activityName: op.activity_name, targetList, overlap, existingTitles });
    }

    // Step 1: Insert AI-suggested related employees (skip duplicates and main responsible)
    const suggestedEmps = (args.suggested_related_employees ?? []).filter(
      (s: any) => empById.has(s.employee_id) && !targetEmpIds.has(s.employee_id)
    );
    if (suggestedEmps.length > 0) {
      const empRows = suggestedEmps.map((s: any) => ({
        executive_plan_id,
        employee_id: s.employee_id,
        role_in_activity: s.role_in_activity || null,
        source: "ai" as const,
        organization_id: orgId,
      }));
      // Insert one-by-one to ignore duplicates from unique constraint (if any)
      for (const r of empRows) {
        const { error } = await admin.from("activity_related_employees").insert(r);
        if (!error) targetEmpIds.add(r.employee_id);
      }
    }

    // Step 2: Insert generated tasks (replace existing AI-generated undispatched, keep manual)
    await admin
      .from("activity_related_tasks")
      .delete()
      .eq("executive_plan_id", executive_plan_id)
      .eq("source", "ai")
      .eq("is_dispatched", false);

    const validTasks = (args.tasks ?? []).filter(
      (t: any) => empById.has(t.employee_id) && targetEmpIds.has(t.employee_id)
    );
    const rows = validTasks
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
        organization_id: orgId,
      }));

    let insertedTasks: any[] = [];
    if (rows.length > 0) {
      const { data: insData, error: insErr } = await admin
        .from("activity_related_tasks")
        .insert(rows)
        .select("*");
      if (insErr) throw insErr;
      insertedTasks = insData ?? [];
    }

    // Step 3: AUTO-DISPATCH all undispatched tasks (AI + any pending) to employees' task lists
    const { data: pendingAll } = await admin
      .from("activity_related_tasks")
      .select("*")
      .eq("executive_plan_id", executive_plan_id)
      .eq("is_dispatched", false);

    let dispatchedCount = 0;
    let skippedNoUser: string[] = [];
    if (pendingAll && pendingAll.length > 0) {
      const empIdsForDispatch = Array.from(new Set(pendingAll.map((t: any) => t.employee_id)));
      const { data: empUsers } = await admin
        .from("employees")
        .select("id, user_id, full_name")
        .in("id", empIdsForDispatch);
      const userByEmp = new Map<string, string | null>(
        (empUsers ?? []).map((e: any) => [e.id, e.user_id])
      );
      const nameByEmp = new Map<string, string>(
        (empUsers ?? []).map((e: any) => [e.id, e.full_name])
      );

      const baseDate = new Date(op.year, opm.month - 1, ep.day);
      const PHASE_LBL: Record<string, string> = { before: "قبل", during: "أثناء", after: "بعد" };

      for (const t of pendingAll as any[]) {
        const userId = userByEmp.get(t.employee_id);
        if (!userId) {
          const nm = nameByEmp.get(t.employee_id);
          if (nm && !skippedNoUser.includes(nm)) skippedNoUser.push(nm);
          continue;
        }
        const due = new Date(baseDate);
        due.setDate(due.getDate() + (t.day_offset ?? 0));
        const dueStr = due.toISOString().slice(0, 10);
        const { data: tIns, error: tErr } = await admin
          .from("tasks")
          .insert({
            title: `[${PHASE_LBL[t.phase] ?? ""}] ${t.title}`,
            description: t.description,
            user_id: userId,
            executive_plan_id,
            source_activity_id: executive_plan_id,
            phase: t.phase,
            priority: t.priority,
            estimated_time_minutes: t.estimated_minutes,
            due_date: dueStr,
            ai_generated: t.source === "ai",
            organization_id: orgId,
            status: "upcoming",
          })
          .select("id")
          .maybeSingle();
        if (tErr) {
          console.error("dispatch insert err", tErr);
          continue;
        }
        await admin
          .from("activity_related_tasks")
          .update({ is_dispatched: true, dispatched_task_id: tIns?.id ?? null })
          .eq("id", t.id);
        dispatchedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        generated_count: rows.length,
        suggested_related_employees: suggestedEmps,
        added_employees_count: suggestedEmps.length,
        dispatched_count: dispatchedCount,
        skipped_no_user: skippedNoUser,
        used_fallback: usedFallback,
        warning,
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