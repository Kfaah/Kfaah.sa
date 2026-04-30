import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// عدد ساعات العمل الافتراضي إذا لم يحدد للموظف
const DEFAULT_WORK_MINUTES = 8 * 60; // 8 ساعات

function minutesBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return DEFAULT_WORK_MINUTES;
  try {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff > 0 && diff < 16 * 60) return diff;
  } catch (_) { /* ignore */ }
  return DEFAULT_WORK_MINUTES;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { month, year, organization_id: bodyOrgId, employee_id: targetEmployeeId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const targetMonth = Number(month) || (new Date().getMonth() + 1);
    const targetYear = Number(year) || new Date().getFullYear();
    const monthName = MONTHS_AR[targetMonth - 1];
    const totalDays = daysInMonth(targetYear, targetMonth);

    // محاولة معرفة المستخدم الحالي لتحديد المنظمة
    let orgId: string | null = bodyOrgId || null;
    const authHeader = req.headers.get("Authorization");
    if (!orgId && authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user?.id) {
        const { data: orgRow } = await supabase
          .from("user_organizations")
          .select("organization_id, is_default")
          .eq("user_id", userData.user.id)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (orgRow?.organization_id) orgId = orgRow.organization_id as string;
      }
    }

    // 1) جلب بيانات المنظمة كسياق
    let orgInfo: any = null;
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, contact_email, contact_phone")
        .eq("id", orgId)
        .maybeSingle();
      orgInfo = org;
    }

    // 2) جلب الخطط التشغيلية الكاملة للسنة (سياق ضخم)
    let opQuery = supabase
      .from("operational_plans")
      .select(`
        id, plan_name, activity_name, strategic_goal, initiative, sub_initiative,
        annual_target, estimated_budget, year, responsible_employee_id, user_id, organization_id
      `)
      .eq("year", targetYear);
    if (orgId) opQuery = opQuery.eq("organization_id", orgId);
    const { data: operationalPlans, error: opError } = await opQuery;
    if (opError) {
      console.error("Operational plans error:", opError);
      throw new Error("فشل في جلب الخطط التشغيلية");
    }

    // 3) جلب الخطط التنفيذية للشهر المحدد
    let epQuery = supabase
      .from("executive_plans")
      .select(`
        id, day, daily_target, achieved, notes, status,
        operational_plan_months!inner (
          id, month, monthly_target,
          operational_plans!inner (
            id, plan_name, activity_name, strategic_goal, initiative, sub_initiative,
            annual_target, estimated_budget, responsible_employee_id, user_id, organization_id
          )
        )
      `)
      .eq("operational_plan_months.month", targetMonth);
    if (orgId) epQuery = epQuery.eq("operational_plan_months.operational_plans.organization_id", orgId);
    const { data: executivePlans, error: epError } = await epQuery;
    if (epError) {
      console.error("Executive plans error:", epError);
      throw new Error("فشل في جلب الخطط التنفيذية");
    }
    if (!executivePlans || executivePlans.length === 0) {
      // اكتشاف الأشهر المتاحة لإرشاد المستخدم
      let availableMonths: number[] = [];
      try {
        let availQuery = supabase
          .from("executive_plans")
          .select(`operational_plan_months!inner(month, operational_plans!inner(year, organization_id))`)
          .eq("operational_plan_months.operational_plans.year", targetYear);
        if (orgId) availQuery = availQuery.eq("operational_plan_months.operational_plans.organization_id", orgId);
        const { data: avail } = await availQuery;
        const set = new Set<number>();
        (avail || []).forEach((r: any) => {
          const m = r.operational_plan_months?.month;
          if (m) set.add(Number(m));
        });
        availableMonths = Array.from(set).sort((a, b) => a - b);
      } catch (_) { /* ignore */ }

      const monthsListAr = availableMonths.length > 0
        ? availableMonths.map(m => MONTHS_AR[m - 1]).join("، ")
        : "";
      const baseMsg = `لا توجد خطط تنفيذية لشهر ${monthName} ${targetYear}.`;
      const hint = availableMonths.length > 0
        ? ` الأشهر المتاحة حالياً: ${monthsListAr}. اختر أحدها أو أضف خططاً تنفيذية لهذا الشهر أولاً.`
        : ` لم يتم العثور على أي خطط تنفيذية لسنة ${targetYear}. يرجى الانتقال إلى صفحة الخطط التنفيذية وتوليدها أو إضافتها أولاً.`;
      return new Response(
        JSON.stringify({ error: baseMsg + hint, available_months: availableMonths }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) جلب جميع الموظفين المرتبطين (مسؤولين ومالكي خطط)
    const employeeIds = new Set<string>();
    const userIdsForEmp = new Set<string>();
    executivePlans.forEach((ep: any) => {
      const op = ep.operational_plan_months?.operational_plans;
      if (op?.responsible_employee_id) employeeIds.add(op.responsible_employee_id);
      if (op?.user_id) userIdsForEmp.add(op.user_id);
    });

    const { data: empByIds } = employeeIds.size > 0
      ? await supabase.from("employees").select("id, user_id, full_name, job_role, title, work_start_time, work_end_time, department_id").in("id", Array.from(employeeIds))
      : { data: [] as any[] };
    const { data: empByUserIds } = userIdsForEmp.size > 0
      ? await supabase.from("employees").select("id, user_id, full_name, job_role, title, work_start_time, work_end_time, department_id").in("user_id", Array.from(userIdsForEmp))
      : { data: [] as any[] };

    const employeesById = new Map<string, any>();
    [...(empByIds || []), ...(empByUserIds || [])].forEach(e => {
      if (e?.id) employeesById.set(e.id, e);
    });
    const employeeByUserId = new Map<string, any>();
    [...(empByIds || []), ...(empByUserIds || [])].forEach(e => {
      if (e?.user_id) employeeByUserId.set(e.user_id, e);
    });

    // 5) جلب ملفات الموظفين كسياق (أسماء وفئات فقط)
    const allUserIds = Array.from(new Set([
      ...(empByIds || []).map(e => e.user_id).filter(Boolean),
      ...Array.from(userIdsForEmp),
    ]));
    const { data: empFiles } = allUserIds.length > 0
      ? await supabase.from("employee_files").select("user_id, file_name, file_type, category").in("user_id", allUserIds).limit(500)
      : { data: [] as any[] };
    const filesByUser = new Map<string, any[]>();
    (empFiles || []).forEach((f: any) => {
      if (!f.user_id) return;
      const arr = filesByUser.get(f.user_id) || [];
      arr.push(f);
      filesByUser.set(f.user_id, arr);
    });

    // 6) تجميع الخطط التنفيذية حسب الموظف المسؤول، مع جميع الأيام الخاصة به في الشهر
    type EpItem = {
      id: string; day: number; dailyTarget: number; achieved: number; notes: string | null;
      activityName: string; strategicGoal: string | null; initiative: string | null; subInitiative: string | null;
      planName: string | null; annualTarget: number | null;
    };
    type EmpBucket = {
      employee: any; userId: string;
      items: EpItem[];
    };

    const buckets = new Map<string, EmpBucket>();
    for (const ep of executivePlans) {
      const op = ep.operational_plan_months?.operational_plans;
      if (!op) continue;
      let employee: any = null;
      let userId: string | null = null;
      if (op.responsible_employee_id) employee = employeesById.get(op.responsible_employee_id) || null;
      if (!employee && op.user_id) employee = employeeByUserId.get(op.user_id) || null;
      userId = employee?.user_id || op.user_id || null;
      if (!userId) continue; // لا يمكن إسناد المهمة بدون user_id
      if (targetEmployeeId && employee?.id !== targetEmployeeId && userId !== targetEmployeeId) continue;

      const key = userId;
      if (!buckets.has(key)) {
        buckets.set(key, { employee: employee || { user_id: userId }, userId, items: [] });
      }
      buckets.get(key)!.items.push({
        id: ep.id,
        day: ep.day,
        dailyTarget: ep.daily_target ?? 0,
        achieved: ep.achieved ?? 0,
        notes: ep.notes ?? null,
        activityName: op.activity_name || "نشاط غير مسمى",
        strategicGoal: op.strategic_goal || null,
        initiative: op.initiative || null,
        subInitiative: op.sub_initiative || null,
        planName: op.plan_name || null,
        annualTarget: op.annual_target ?? null,
      });
    }

    if (buckets.size === 0) {
      return new Response(
        JSON.stringify({ error: "لا يوجد موظفون مرتبطون بالخطط التنفيذية لهذا الشهر." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7) لكل موظف: نولّد دفعة واحدة (call AI واحد) تحوي مهام جميع أيام الشهر التي له فيها أنشطة
    const allTasks: any[] = [];
    let processedEmployees = 0;
    let creditExhausted = false;

    const processBucket = async (bucket: EmpBucket) => {
      if (creditExhausted) return;
      const emp = bucket.employee || {};
      const workMinutes = minutesBetween(emp.work_start_time, emp.work_end_time);

      // تجميع الأنشطة حسب اليوم
      const dayMap = new Map<number, EpItem[]>();
      for (const it of bucket.items) {
        const arr = dayMap.get(it.day) || [];
        arr.push(it);
        dayMap.set(it.day, arr);
      }
      const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);

      // سياق الخطط التشغيلية الخاصة بهذا الموظف (سنوي)
      const empOpPlans = (operationalPlans || []).filter((p: any) =>
        (p.responsible_employee_id && p.responsible_employee_id === emp.id) ||
        (p.user_id && p.user_id === bucket.userId)
      );

      const filesContext = (filesByUser.get(bucket.userId) || []).slice(0, 30)
        .map((f: any) => `- ${f.file_name} (${f.category || f.file_type || "ملف"})`).join("\n") || "لا توجد ملفات مرفوعة.";

      const opPlansContext = empOpPlans.length > 0
        ? empOpPlans.map((p: any) => `• الخطة: ${p.plan_name || p.activity_name}
  - الهدف الاستراتيجي: ${p.strategic_goal || "—"}
  - المبادرة: ${p.initiative || "—"}${p.sub_initiative ? ` / ${p.sub_initiative}` : ""}
  - النشاط: ${p.activity_name}
  - الهدف السنوي: ${p.annual_target ?? "—"} | الميزانية المقدرة: ${p.estimated_budget ?? "—"}`).join("\n\n")
        : "لا توجد خطط تشغيلية سنوية مسجلة لهذا الموظف.";

      const daysContext = sortedDays.map(d => {
        const items = dayMap.get(d)!;
        const itemsTxt = items.map(it => `   - ${it.activityName} | الهدف اليومي: ${it.dailyTarget}${it.notes ? ` | ملاحظات: ${it.notes}` : ""}`).join("\n");
        return `يوم ${d}/${targetMonth}/${targetYear}:\n${itemsTxt}`;
      }).join("\n\n");

      const systemPrompt = `أنت مدير تخطيط تنفيذي خبير في المؤسسات الخيرية وغير الربحية، تتولى تحويل الخطط التشغيلية والتنفيذية إلى مهام يومية احترافية ودقيقة لكل موظف بحسب تخصصه وإمكاناته.

قواعد إلزامية:
1) لا تختلق مهام عامة أو مكررة. كل مهمة يجب أن تكون **منبثقة فعلياً** من نشاط محدد في الخطة التنفيذية لذلك اليوم بالذات، ومرتبطة بالهدف الاستراتيجي والمبادرة.
2) لكل يوم يحتوي على أنشطة، أنشئ بين **5 و 7 مهام يومياً**. **استثناء**: إذا كان مجموع تقديرات الوقت لمهام اليوم سيتجاوز ساعات عمل الموظف (${workMinutes} دقيقة)، أو كانت المهام كثيفة (تتطلب ميدان أو اجتماعات)، فقلل العدد إلى **3 إلى 4 مهام** فقط، مع زيادة estimated_time_minutes لكل واحدة.
3) راعِ **تخصص الموظف ودوره الوظيفي** (${emp.job_role || "غير محدد"}${emp.title ? ` - ${emp.title}` : ""}) في صياغة المهام: لا تكلف موظف موارد بشرية بمهمة تقنية، ولا العكس. اربط المهام بطبيعة عمله.
4) كل مهمة يجب أن تكون **محددة، قابلة للقياس، عملية، ومحصورة في يوم واحد**. تجنب الصياغات الفضفاضة مثل "متابعة" أو "العمل على".
5) وزّع المهام عبر اليوم بشكل منطقي: تخطيط في البداية، تنفيذ في المنتصف، توثيق ومتابعة في النهاية.
6) قدّر estimated_time_minutes بدقة (15-180 دقيقة عادة) بحيث لا يتجاوز إجمالي اليوم ${workMinutes} دقيقة.
7) حدد priority: high للمهام الحرجة المرتبطة بالأهداف الكبرى، medium للأنشطة الأساسية، low للتوثيق والمتابعة.
8) استخدم category مأخوذة من اسم النشاط الأصلي.
9) executive_plan_id لكل مهمة **يجب** أن يكون أحد المعرفات المتوفرة لذلك اليوم (سأمرّرها لك).

استخدم الأداة generate_daily_tasks فقط، ولا تخرج عن المخطط.`;

      // نمرر للمودل خريطة executive_plan_id لكل يوم/نشاط لاستخدامها مباشرة
      const planIdsByDay = sortedDays.map(d => {
        const items = dayMap.get(d)!;
        return `يوم ${d}: ${items.map(it => `[${it.activityName} -> ${it.id}]`).join(" , ")}`;
      }).join("\n");

      const userPrompt = `# سياق المنظمة
${orgInfo ? `الجمعية: ${orgInfo.name}` : "جمعية خيرية"}

# الموظف المستهدف
- الاسم: ${emp.full_name || "موظف"}
- الدور الوظيفي: ${emp.job_role || "غير محدد"}
- المسمى: ${emp.title || "—"}
- ساعات العمل اليومية: ${Math.round(workMinutes / 60 * 10) / 10} ساعة (${workMinutes} دقيقة)
- ملفاته المرفوعة (للسياق فقط):
${filesContext}

# خططه التشغيلية السنوية (${targetYear})
${opPlansContext}

# الخطط التنفيذية لهذا الموظف خلال شهر ${monthName} ${targetYear}
${daysContext}

# معرّفات الخطط التنفيذية لكل يوم (استخدمها كـ executive_plan_id)
${planIdsByDay}

المطلوب: ولّد قائمة مهام يومية احترافية وفق القواعد. أنشئ مهام لكل يوم من الأيام المذكورة أعلاه فقط (لا تتجاوزها).`;

      try {
        const aiController = new AbortController();
        const aiTimeout = setTimeout(() => aiController.abort(), 90_000);
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: aiController.signal,
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "generate_daily_tasks",
                  description: "إرجاع قائمة المهام اليومية للموظف خلال الشهر، 5-7 مهام لكل يوم (3-4 إذا كانت كثيفة).",
                  parameters: {
                    type: "object",
                    properties: {
                      tasks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string", description: "عنوان مهمة محدد ودقيق" },
                            description: { type: "string", description: "وصف تفصيلي يوضح خطوات التنفيذ والمخرج المتوقع" },
                            priority: { type: "string", enum: ["low", "medium", "high"] },
                            category: { type: "string", description: "اسم النشاط أو التصنيف" },
                            day: { type: "number", description: "اليوم في الشهر (1-31)" },
                            executive_plan_id: { type: "string", description: "معرّف الخطة التنفيذية المرتبطة من القائمة المعطاة" },
                            estimated_time_minutes: { type: "number", description: "تقدير الوقت بالدقائق" },
                          },
                          required: ["title", "description", "priority", "category", "day", "executive_plan_id", "estimated_time_minutes"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["tasks"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "generate_daily_tasks" } },
          }),
        });

        if (!response.ok) {
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "نفد رصيد الذكاء الاصطناعي. يرجى إضافة رصيد." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 429) {
            console.warn("Rate limit for employee:", bucket.userId);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          const errTxt = await response.text();
          console.error("AI error:", response.status, errTxt);
          continue;
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) continue;
        const parsed = JSON.parse(toolCall.function.arguments);
        const validIds = new Set(bucket.items.map(i => i.id));

        for (const task of parsed.tasks || []) {
          // تحقق من المعرّف
          let epId = validIds.has(task.executive_plan_id) ? task.executive_plan_id : null;
          if (!epId) {
            // أعد بناء fallback من اليوم
            const fallback = bucket.items.find(i => i.day === task.day);
            if (fallback) epId = fallback.id;
          }
          if (!epId) continue;

          const day = Math.max(1, Math.min(totalDays, Number(task.day) || 1));
          const dueDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

          allTasks.push({
            title: String(task.title).slice(0, 300),
            description: String(task.description || "").slice(0, 4000),
            user_id: bucket.userId,
            executive_plan_id: epId,
            priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
            category: String(task.category || "عام").slice(0, 200),
            status: "pending",
            ai_generated: true,
            due_date: dueDate,
            estimated_time_minutes: Math.max(10, Math.min(480, Number(task.estimated_time_minutes) || 45)),
            organization_id: orgId,
          });
        }
      } catch (aiError) {
        console.error("AI exception for user:", bucket.userId, aiError);
      }

      // تأخير صغير لتجنب rate limit
      await new Promise(r => setTimeout(r, 600));
    }

    if (allTasks.length === 0) {
      return new Response(
        JSON.stringify({ error: "لم يتم توليد أي مهام. تأكد من توفر خطط تنفيذية وموظفين مرتبطين." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ضمان عدم تجاوز ساعات عمل الموظف يومياً (تجريم بناءً على estimated_time_minutes)
    const tasksByUserDay = new Map<string, any[]>();
    for (const t of allTasks) {
      const k = `${t.user_id}__${t.due_date}`;
      const arr = tasksByUserDay.get(k) || [];
      arr.push(t);
      tasksByUserDay.set(k, arr);
    }
    const finalTasks: any[] = [];
    for (const [, arr] of tasksByUserDay) {
      // اقتطع إذا تجاوز المجموع 9 ساعات
      arr.sort((a, b) => (b.priority === "high" ? 1 : 0) - (a.priority === "high" ? 1 : 0));
      let acc = 0;
      const hardCap = 9 * 60;
      const kept: any[] = [];
      for (const t of arr) {
        if (kept.length >= 7) break; // حد أقصى 7
        if (acc + t.estimated_time_minutes > hardCap) continue;
        acc += t.estimated_time_minutes;
        kept.push(t);
      }
      // ضمان حد أدنى 3 إذا أمكن
      if (kept.length < 3 && arr.length >= 3) {
        for (const t of arr) {
          if (kept.includes(t)) continue;
          kept.push(t);
          if (kept.length >= 3) break;
        }
      }
      finalTasks.push(...kept);
    }

    // حذف المهام المولدة سابقاً للشهر نفسه لكل مستخدم
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
    const uniqueUserIds = Array.from(new Set(finalTasks.map(t => t.user_id)));
    for (const uid of uniqueUserIds) {
      await supabase
        .from("tasks")
        .delete()
        .eq("user_id", uid)
        .eq("ai_generated", true)
        .gte("due_date", startDate)
        .lte("due_date", endDate);
    }

    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(finalTasks)
      .select();
    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("فشل في حفظ المهام: " + insertError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks: insertedTasks,
        message: `تم توليد ${insertedTasks!.length} مهمة احترافية لـ ${uniqueUserIds.length} موظف خلال شهر ${monthName} ${targetYear}`,
        employeesProcessed: processedEmployees,
        daysCovered: new Set(finalTasks.map(t => t.due_date)).size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-tasks fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
