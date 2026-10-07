import { withRulesMode } from "../_shared/rule-mode.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const DEFAULT_WORK_MINUTES = 8 * 60;
const AI_URL = (Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions");

type GenerationRequest = {
  month?: number | string;
  year?: number | string;
  organization_id?: string | null;
  employee_id?: string | null;
  operational_plan_ids?: string[];
};

type EpItem = {
  id: string;
  day: number;
  dailyTarget: number;
  achieved: number;
  notes: string | null;
  activityName: string;
  strategicGoal: string | null;
  initiative: string | null;
  subInitiative: string | null;
  planName: string | null;
  annualTarget: number | null;
};

type EmpBucket = {
  employee: any;
  userId: string;
  items: EpItem[];
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function minutesBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return DEFAULT_WORK_MINUTES;
  try {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff > 0 && diff < 16 * 60) return diff;
  } catch (_) {
    // ignore malformed shifts
  }
  return DEFAULT_WORK_MINUTES;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function safeMonth(month: unknown) {
  const value = Number(month) || (new Date().getMonth() + 1);
  return Math.max(1, Math.min(12, Math.trunc(value)));
}

function safeYear(year: unknown) {
  const value = Number(year) || new Date().getFullYear();
  return Math.max(2020, Math.min(2100, Math.trunc(value)));
}

async function getAuthenticatedUser(req: Request, supabaseUrl: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function resolveOrganizationId(supabase: any, userId: string, requestedOrgId?: string | null) {
  if (requestedOrgId) return requestedOrgId;

  const { data: orgRow } = await supabase
    .from("user_organizations")
    .select("organization_id, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  return orgRow?.organization_id ?? null;
}

async function findAvailableMonths(supabase: any, targetYear: number, orgId: string | null) {
  try {
    let availQuery = supabase
      .from("operational_plan_months")
      .select(`month, monthly_target, operational_plans!inner(year, organization_id)`)
      .eq("operational_plans.year", targetYear)
      .gt("monthly_target", 0);
    if (orgId) availQuery = availQuery.eq("operational_plans.organization_id", orgId);

    const { data: avail } = await availQuery;
    const set = new Set<number>();
    (avail || []).forEach((r: any) => {
      const m = r?.month;
      if (m) set.add(Number(m));
    });
    return Array.from(set).sort((a, b) => a - b);
  } catch (_) {
    return [];
  }
}

async function validateGenerationPrerequisites(supabase: any, targetYear: number, targetMonth: number, orgId: string | null) {
  let epQuery = supabase
    .from("operational_plan_months")
    .select("id, month, monthly_target, operational_plans!inner(year, organization_id)")
    .eq("month", targetMonth)
    .eq("operational_plans.year", targetYear)
    .gt("monthly_target", 0)
    .limit(1);

  if (orgId) epQuery = epQuery.eq("operational_plans.organization_id", orgId);

  const { data, error } = await epQuery;
  if (error) throw new Error("فشل في التحقق من الخطط التشغيلية");
  if (data && data.length > 0) return null;

  const availableMonths = await findAvailableMonths(supabase, targetYear, orgId);
  const monthsListAr = availableMonths.length > 0
    ? availableMonths.map((m) => MONTHS_AR[m - 1]).join("، ")
    : "";
  const baseMsg = `لا توجد مستهدفات شهرية لشهر ${MONTHS_AR[targetMonth - 1]} ${targetYear}.`;
  const hint = availableMonths.length > 0
    ? ` الأشهر التي تحتوي مستهدفات: ${monthsListAr}. اختر أحدها أو أضف مستهدفات لهذا الشهر في الخطة التشغيلية أولاً.`
    : ` لم يتم العثور على أي مستهدفات شهرية لسنة ${targetYear}. يرجى الانتقال إلى صفحة الخطط التشغيلية وإضافة مستهدفات للأشهر أولاً.`;

  return { error: baseMsg + hint, available_months: availableMonths };
}

async function updateJob(supabase: any, jobId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("task_generation_jobs")
    .update(patch)
    .eq("id", jobId);
  if (error) console.error("task_generation_jobs update failed:", error);
}

async function callAIForBucket(params: {
  KFAAH_AI_API_KEY: string;
  bucket: EmpBucket;
  filesByUser: Map<string, any[]>;
  operationalPlans: any[];
  orgInfo: any;
  targetYear: number;
  targetMonth: number;
  totalDays: number;
  orgId: string | null;
}) {
  const { KFAAH_AI_API_KEY, bucket, filesByUser, operationalPlans, orgInfo, targetYear, targetMonth, totalDays, orgId } = params;
  const monthName = MONTHS_AR[targetMonth - 1];
  const emp = bucket.employee || {};
  const workMinutes = minutesBetween(emp.work_start_time, emp.work_end_time);

  const dayMap = new Map<number, EpItem[]>();
  for (const it of bucket.items) {
    const arr = dayMap.get(it.day) || [];
    arr.push(it);
    dayMap.set(it.day, arr);
  }
  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);

  const empOpPlans = (operationalPlans || []).filter((p: any) =>
    (p.responsible_employee_id && p.responsible_employee_id === emp.id) ||
    (p.user_id && p.user_id === bucket.userId),
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

  const daysContext = sortedDays.map((d) => {
    const items = dayMap.get(d)!;
    const itemsTxt = items.map((it) => `   - ${it.activityName} | الهدف اليومي: ${it.dailyTarget}${it.notes ? ` | ملاحظات: ${it.notes}` : ""}`).join("\n");
    return `يوم ${d}/${targetMonth}/${targetYear}:\n${itemsTxt}`;
  }).join("\n\n");

  const systemPrompt = `أنت مدير تخطيط تنفيذي خبير في المؤسسات الخيرية وغير الربحية، تتولى تحويل الخطط التشغيلية والتنفيذية إلى مهام يومية احترافية ودقيقة لكل موظف بحسب تخصصه وإمكاناته.

قواعد إلزامية:
1) لا تختلق مهام عامة أو مكررة. كل مهمة يجب أن تكون منبثقة فعلياً من نشاط محدد في الخطة التنفيذية لذلك اليوم بالذات، ومرتبطة بالهدف الاستراتيجي والمبادرة.
2) لكل يوم يحتوي على أنشطة، أنشئ بين 5 و 7 مهام يومياً. استثناء: إذا كان مجموع تقديرات الوقت لمهام اليوم سيتجاوز ساعات عمل الموظف (${workMinutes} دقيقة)، أو كانت المهام كثيفة، فقلل العدد إلى 3 إلى 4 مهام فقط.
3) راعِ تخصص الموظف ودوره الوظيفي (${emp.job_role || "غير محدد"}${emp.title ? ` - ${emp.title}` : ""}).
4) كل مهمة يجب أن تكون محددة، قابلة للقياس، عملية، ومحصورة في يوم واحد.
5) وزّع المهام عبر اليوم بشكل منطقي: تخطيط، تنفيذ، توثيق ومتابعة.
6) قدّر estimated_time_minutes بدقة بحيث لا يتجاوز إجمالي اليوم ${workMinutes} دقيقة.
7) حدد priority: high للمهام الحرجة، medium للأنشطة الأساسية، low للتوثيق والمتابعة.
8) استخدم category مأخوذة من اسم النشاط الأصلي.
9) executive_plan_id لكل مهمة يجب أن يكون أحد المعرفات المتوفرة لذلك اليوم.

استخدم الأداة generate_daily_tasks فقط، ولا تخرج عن المخطط.`;

  const planIdsByDay = sortedDays.map((d) => {
    const items = dayMap.get(d)!;
    return `يوم ${d}: ${items.map((it) => `[${it.activityName} -> ${it.id}]`).join(" , ")}`;
  }).join("\n");

  const userPrompt = `# سياق المنظمة
${orgInfo ? `الجمعية: ${orgInfo.name}` : "جمعية خيرية"}

# الموظف المستهدف
- الاسم: ${emp.full_name || "موظف"}
- الدور الوظيفي: ${emp.job_role || "غير محدد"}
- المسمى: ${emp.title || "—"}
- ساعات العمل اليومية: ${Math.round(workMinutes / 60 * 10) / 10} ساعة (${workMinutes} دقيقة)
- ملفاته المرفوعة:
${filesContext}

# خططه التشغيلية السنوية (${targetYear})
${opPlansContext}

# الخطط التنفيذية لهذا الموظف خلال شهر ${monthName} ${targetYear}
${daysContext}

# معرّفات الخطط التنفيذية لكل يوم
${planIdsByDay}

المطلوب: ولّد قائمة مهام يومية احترافية وفق القواعد. أنشئ مهام لكل يوم من الأيام المذكورة فقط.`;

  const aiController = new AbortController();
  const aiTimeout = setTimeout(() => aiController.abort(), 110_000);

  try {
    const response = await fetch(AI_URL, {
      method: "POST",
      signal: aiController.signal,
      headers: {
        Authorization: `Bearer ${KFAAH_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_daily_tasks",
              description: "إرجاع قائمة المهام اليومية للموظف خلال الشهر.",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high"] },
                        category: { type: "string" },
                        day: { type: "number" },
                        executive_plan_id: { type: "string" },
                        estimated_time_minutes: { type: "number" },
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
      const errTxt = await response.text();
      const err: any = new Error(response.status === 402
        ? "نفد رصيد الذكاء الاصطناعي. يرجى إضافة رصيد."
        : response.status === 429
          ? "تم تجاوز الحد المسموح، حاول لاحقاً"
          : `AI error ${response.status}: ${errTxt.slice(0, 300)}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const validIds = new Set(bucket.items.map((i) => i.id));
    const generated: any[] = [];

    for (const task of parsed.tasks || []) {
      let epId = validIds.has(task.executive_plan_id) ? task.executive_plan_id : null;
      if (!epId) {
        const fallback = bucket.items.find((i) => i.day === task.day);
        if (fallback) epId = fallback.id;
      }
      if (!epId) continue;

      const day = Math.max(1, Math.min(totalDays, Number(task.day) || 1));
      const dueDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      generated.push({
        title: String(task.title || "مهمة تنفيذية").slice(0, 300),
        description: String(task.description || "").slice(0, 4000),
        user_id: bucket.userId,
        executive_plan_id: epId,
        priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
        category: String(task.category || "عام").slice(0, 200),
        status: "upcoming",
        ai_generated: true,
        due_date: dueDate,
        estimated_time_minutes: Math.max(10, Math.min(480, Number(task.estimated_time_minutes) || 45)),
        organization_id: orgId,
      });
    }

    return generated;
  } finally {
    clearTimeout(aiTimeout);
  }
}

async function processGenerationJob(params: {
  jobId: string;
  supabase: any;
  KFAAH_AI_API_KEY: string;
  orgId: string | null;
  targetMonth: number;
  targetYear: number;
  targetEmployeeId: string | null;
  operationalPlanIds?: string[] | null;
}) {
  const { jobId, supabase, KFAAH_AI_API_KEY, orgId, targetMonth, targetYear, targetEmployeeId, operationalPlanIds } = params;
  const monthName = MONTHS_AR[targetMonth - 1];
  const totalDays = daysInMonth(targetYear, targetMonth);

  try {
    await updateJob(supabase, jobId, {
      status: "processing",
      started_at: new Date().toISOString(),
      message: "جاري تحليل الخطط التنفيذية وربطها بالموظفين...",
      error_message: null,
    });

    let orgInfo: any = null;
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, contact_email, contact_phone")
        .eq("id", orgId)
        .maybeSingle();
      orgInfo = org;
    }

    let opQuery = supabase
      .from("operational_plans")
      .select(`
        id, plan_name, activity_name, strategic_goal, initiative, sub_initiative,
        annual_target, estimated_budget, year, responsible_employee_id, user_id, organization_id
      `)
      .eq("year", targetYear);
    if (orgId) opQuery = opQuery.eq("organization_id", orgId);
    const { data: operationalPlans, error: opError } = await opQuery;
    if (opError) throw new Error("فشل في جلب الخطط التشغيلية");

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
      .eq("operational_plan_months.month", targetMonth)
      .eq("operational_plan_months.operational_plans.year", targetYear);
    if (orgId) epQuery = epQuery.eq("operational_plan_months.operational_plans.organization_id", orgId);
    if (operationalPlanIds && operationalPlanIds.length > 0) {
      epQuery = epQuery.in("operational_plan_months.operational_plans.id", operationalPlanIds);
    }
    const { data: executivePlans, error: epError } = await epQuery;
    if (epError) throw new Error("فشل في جلب الخطط التنفيذية");
    if (!executivePlans || executivePlans.length === 0) {
      throw new Error(`لا توجد خطط تنفيذية لشهر ${monthName} ${targetYear}.`);
    }

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
    [...(empByIds || []), ...(empByUserIds || [])].forEach((e) => {
      if (e?.id) employeesById.set(e.id, e);
    });
    const employeeByUserId = new Map<string, any>();
    [...(empByIds || []), ...(empByUserIds || [])].forEach((e) => {
      if (e?.user_id) employeeByUserId.set(e.user_id, e);
    });

    const allUserIds = Array.from(new Set([
      ...(empByIds || []).map((e) => e.user_id).filter(Boolean),
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

    const buckets = new Map<string, EmpBucket>();
    for (const ep of executivePlans) {
      const op = ep.operational_plan_months?.operational_plans;
      if (!op) continue;
      let employee: any = null;
      let userId: string | null = null;
      if (op.responsible_employee_id) employee = employeesById.get(op.responsible_employee_id) || null;
      if (!employee && op.user_id) employee = employeeByUserId.get(op.user_id) || null;
      userId = employee?.user_id || op.user_id || null;
      if (!userId) continue;
      if (targetEmployeeId && employee?.id !== targetEmployeeId && userId !== targetEmployeeId) continue;

      const key = userId;
      if (!buckets.has(key)) buckets.set(key, { employee: employee || { user_id: userId }, userId, items: [] });
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
      throw new Error("لا يوجد موظفون مرتبطون بالخطط التنفيذية لهذا الشهر.");
    }

    const bucketList = Array.from(buckets.values());
    await updateJob(supabase, jobId, {
      total_employees: bucketList.length,
      message: `تم العثور على ${bucketList.length} موظف. جاري توليد المهام...`,
    });

    const allTasks: any[] = [];
    let processedEmployees = 0;
    // Process ALL employees fully in parallel (each bucket = 1 AI call).
    // Lovable AI gateway handles concurrency well; this collapses total wall time
    // from O(N) to ~O(1 single AI call), turning 3+ minutes into ~30-60 seconds.
    const settled = await Promise.allSettled(
      bucketList.map(async (bucket) => {
        const tasks = await callAIForBucket({
          KFAAH_AI_API_KEY, bucket, filesByUser,
          operationalPlans: operationalPlans || [],
          orgInfo, targetYear, targetMonth, totalDays, orgId,
        });
        // Live progress update as each employee finishes
        processedEmployees += 1;
        allTasks.push(...tasks);
        updateJob(supabase, jobId, {
          processed_employees: processedEmployees,
          generated_tasks_count: allTasks.length,
          message: `تمت معالجة ${processedEmployees} من ${bucketList.length} موظف...`,
        }).catch(() => {});
        return tasks;
      })
    );

    for (const result of settled) {
      if (result.status === "rejected") {
        const reason: any = result.reason;
        if (reason?.status === 402) throw reason;
        console.error("AI bucket failed:", reason);
      }
    }

    if (allTasks.length === 0) {
      throw new Error("لم يتم توليد أي مهام. تأكد من توفر خطط تنفيذية وموظفين مرتبطين.");
    }

    const tasksByUserDay = new Map<string, any[]>();
    for (const t of allTasks) {
      const k = `${t.user_id}__${t.due_date}`;
      const arr = tasksByUserDay.get(k) || [];
      arr.push(t);
      tasksByUserDay.set(k, arr);
    }

    const finalTasks: any[] = [];
    for (const [, arr] of tasksByUserDay) {
      arr.sort((a, b) => (b.priority === "high" ? 1 : 0) - (a.priority === "high" ? 1 : 0));
      let acc = 0;
      const hardCap = 9 * 60;
      const kept: any[] = [];
      for (const t of arr) {
        if (kept.length >= 7) break;
        if (acc + t.estimated_time_minutes > hardCap) continue;
        acc += t.estimated_time_minutes;
        kept.push(t);
      }
      if (kept.length < 3 && arr.length >= 3) {
        for (const t of arr) {
          if (kept.includes(t)) continue;
          kept.push(t);
          if (kept.length >= 3) break;
        }
      }
      finalTasks.push(...kept);
    }

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
    const uniqueUserIds = Array.from(new Set(finalTasks.map((t) => t.user_id)));

    await updateJob(supabase, jobId, { message: "جاري حفظ المهام واستبدال المهام المولدة سابقاً..." });

    for (const uid of uniqueUserIds) {
      let deleteQuery = supabase
        .from("tasks")
        .delete()
        .eq("user_id", uid)
        .eq("ai_generated", true)
        .gte("due_date", startDate)
        .lte("due_date", endDate);
      if (orgId) deleteQuery = deleteQuery.eq("organization_id", orgId);
      await deleteQuery;
    }

    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(finalTasks)
      .select();
    if (insertError) throw new Error("فشل في حفظ المهام: " + insertError.message);

    const message = `تم توليد ${insertedTasks?.length || 0} مهمة احترافية لـ ${uniqueUserIds.length} موظف خلال شهر ${monthName} ${targetYear}`;
    await updateJob(supabase, jobId, {
      status: "completed",
      processed_employees: processedEmployees,
      generated_tasks_count: insertedTasks?.length || 0,
      days_covered: new Set(finalTasks.map((t) => t.due_date)).size,
      message,
      result: {
        message,
        task_ids: (insertedTasks || []).map((t: any) => t.id),
      },
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("generate-tasks job failed:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء توليد المهام";
    await updateJob(supabase, jobId, {
      status: "failed",
      error_message: message,
      message,
      completed_at: new Date().toISOString(),
    });
  }
}

serve(withRulesMode("generate-tasks", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const user = await getAuthenticatedUser(req, supabaseUrl);
    if (!user?.id) {
      return jsonResponse({ error: "يجب تسجيل الدخول لتوليد المهام بالذكاء الاصطناعي." }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as GenerationRequest;
    const targetMonth = safeMonth(body.month);
    const targetYear = safeYear(body.year);
    const targetEmployeeId = body.employee_id || null;
    const operationalPlanIds = Array.isArray(body.operational_plan_ids) && body.operational_plan_ids.length > 0
      ? body.operational_plan_ids
      : null;
    const orgId = await resolveOrganizationId(supabase, user.id, body.organization_id);

    if (!orgId) {
      return jsonResponse({ error: "لم يتم تحديد الجمعية المرتبطة بالتوليد." }, 400);
    }

    const prerequisiteError = await validateGenerationPrerequisites(supabase, targetYear, targetMonth, orgId);
    if (prerequisiteError) return jsonResponse(prerequisiteError, 404);

    const { data: existingJob } = await supabase
      .from("task_generation_jobs")
      .select("id, status, message, created_at")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .eq("requested_year", targetYear)
      .eq("requested_month", targetMonth)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob?.id) {
      return jsonResponse({
        success: true,
        queued: true,
        jobId: existingJob.id,
        status: existingJob.status,
        message: existingJob.message || "توجد عملية توليد قيد التنفيذ لهذا الشهر.",
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("task_generation_jobs")
      .insert({
        user_id: user.id,
        organization_id: orgId,
        requested_month: targetMonth,
        requested_year: targetYear,
        employee_id: targetEmployeeId,
        status: "pending",
        request_payload: {
          month: targetMonth,
          year: targetYear,
          organization_id: orgId,
          employee_id: targetEmployeeId,
          operational_plan_ids: operationalPlanIds,
        },
        message: "تم وضع طلب توليد المهام في قائمة المعالجة.",
      })
      .select("id, status, message")
      .single();

    if (jobError || !job?.id) {
      throw new Error("تعذر إنشاء طلب توليد المهام.");
    }

    const processingPromise = processGenerationJob({
      jobId: job.id,
      supabase,
      KFAAH_AI_API_KEY,
      orgId,
      targetMonth,
      targetYear,
      targetEmployeeId,
      operationalPlanIds,
    });

    // Return immediately to avoid the 150s HTTP idle timeout, then continue the heavy AI work in the background.
    if (typeof EdgeRuntime !== "undefined" && "waitUntil" in EdgeRuntime) {
      EdgeRuntime.waitUntil(processingPromise);
    } else {
      processingPromise.catch((err) => console.error("background task failed:", err));
    }

    return jsonResponse({
      success: true,
      queued: true,
      jobId: job.id,
      status: "pending",
      message: "بدأ توليد المهام في الخلفية. يمكنك متابعة الصفحة وسيتم تحديث النتيجة تلقائياً.",
    });
  } catch (error) {
    console.error("generate-tasks fatal:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" }, 500);
  }
}));

