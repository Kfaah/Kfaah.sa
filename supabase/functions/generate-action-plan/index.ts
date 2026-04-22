// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type OrgMetrics = {
  org_id: string;
  org_name: string;
  total_donated: number;
  donations_count: number;
  avg_donation: number;
  donors: number;
  recurring_donors: number;
  abandoned_carts: number;
  recovered_carts: number;
  recovery_rate: number;
  bank_transfers: number;
  matched_transfers: number;
  employees_count: number;
  tasks_total: number;
  tasks_completed: number;
  task_completion_rate: number;
  campaigns: number;
  fundraising_score: number;
  donor_engagement_score: number;
  service_score: number;
  team_score: number;
  overall_score: number;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

async function buildOrgMetrics(admin: any): Promise<OrgMetrics[]> {
  const { data: orgs, error: orgsErr } = await admin
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (orgsErr) throw orgsErr;

  const metrics = await Promise.all((orgs || []).map(async (org: any) => {
    const orgId = org.id;
    const head = { count: "exact" as const, head: true };

    const [
      donorsTotalRes,
      donationsCountRes,
      donationsRes,
      recurringRes,
      abandonedRes,
      recoveredRes,
      transfersRes,
      matchedRes,
      campaignsRes,
      tasksTotalRes,
      tasksDoneRes,
      employeesRes,
    ] = await Promise.all([
      admin.from("donors").select("*", head).eq("organization_id", orgId),
      admin.from("donations").select("*", head).eq("organization_id", orgId),
      admin.from("donations").select("amount, donor_id, donor_phone").eq("organization_id", orgId).limit(20000),
      admin.from("donors").select("*", head).eq("organization_id", orgId).gte("donations_count", 2),
      admin.from("abandoned_carts").select("*", head).eq("organization_id", orgId),
      admin.from("abandoned_carts").select("*", head).eq("organization_id", orgId).eq("recovered", true),
      admin.from("bank_transfers").select("*", head).eq("organization_id", orgId),
      admin.from("bank_transfers").select("*", head).eq("organization_id", orgId).eq("reconciliation_status", "matched"),
      admin.from("campaigns").select("*", head).eq("organization_id", orgId),
      admin.from("tasks").select("*", head).eq("organization_id", orgId),
      admin.from("tasks").select("*", head).eq("organization_id", orgId).eq("status", "completed"),
      admin.from("employees").select("*", head).eq("organization_id", orgId),
    ]);

    const donationRows = donationsRes.data || [];
    const total_donated = donationRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const donations_count = donationsCountRes.count || 0;
    const donors_total = donorsTotalRes.count || 0;
    const activeSet = new Set<string>();
    donationRows.forEach((row: any) => {
      const key = row.donor_id || row.donor_phone;
      if (key) activeSet.add(String(key));
    });

    const donors = activeSet.size > 0 ? activeSet.size : donors_total;
    const recurring = recurringRes.count || 0;
    const abandoned = abandonedRes.count || 0;
    const recovered = recoveredRes.count || 0;
    const transfers = transfersRes.count || 0;
    const matched = matchedRes.count || 0;
    const tasksTotal = tasksTotalRes.count || 0;
    const tasksDone = tasksDoneRes.count || 0;
    const employees = employeesRes.count || 0;

    const avg_donation = donations_count ? total_donated / donations_count : 0;
    const recovery_rate = abandoned ? (recovered / abandoned) * 100 : 0;
    const match_rate = transfers ? (matched / transfers) * 100 : 0;
    const completion = tasksTotal ? (tasksDone / tasksTotal) * 100 : 0;
    const recurring_pct = donors_total ? (recurring / donors_total) * 100 : 0;

    const donor_engagement_score = clamp(recurring_pct * 1.5 + (donors > 0 ? Math.min(40, Math.log10(donors + 1) * 12) : 0));
    const service_score = clamp(recovery_rate * 0.6 + match_rate * 0.4);
    const team_score = clamp(completion * 0.7 + Math.log10(employees + 1) * 10);

    return {
      org_id: orgId,
      org_name: org.name,
      total_donated,
      donations_count,
      avg_donation,
      donors,
      recurring_donors: recurring,
      abandoned_carts: abandoned,
      recovered_carts: recovered,
      recovery_rate,
      bank_transfers: transfers,
      matched_transfers: matched,
      employees_count: employees,
      tasks_total: tasksTotal,
      tasks_completed: tasksDone,
      task_completion_rate: completion,
      campaigns: campaignsRes.count || 0,
      fundraising_score: 0,
      donor_engagement_score,
      service_score,
      team_score,
      overall_score: 0,
    } satisfies OrgMetrics;
  }));

  const maxTotal = metrics.reduce((max: number, metric: OrgMetrics) => Math.max(max, metric.total_donated || 0), 0);

  return metrics.map((metric) => {
    const fundraising_score = maxTotal > 0 ? clamp((metric.total_donated / maxTotal) * 100) : 0;
    const overall_score = clamp(
      (fundraising_score + metric.donor_engagement_score + metric.service_score + metric.team_score) / 4,
    );

    return { ...metric, fundraising_score, overall_score };
  });
}

async function generateInsight(admin: any, apiKey: string, metrics: OrgMetrics, allMetrics: OrgMetrics[]) {
  const peers = allMetrics.filter((m) => m.org_id !== metrics.org_id);
  const avgRev = peers.length ? peers.reduce((sum, m) => sum + m.total_donated, 0) / peers.length : 0;
  const avgScore = peers.length ? peers.reduce((sum, m) => sum + m.overall_score, 0) / peers.length : 0;

  const systemPrompt = `أنت محلل بيانات تنفيذي خبير في إدارة الجمعيات الخيرية والتبرعات وخدمة المتبرعين. مهمتك إنتاج تحليل عربي احترافي شامل وثابت لنفس المدخلات.
قواعد إلزامية:
- اعتمد فقط على الأرقام المرسلة ولا تخترع أي رقم أو معلومة.
- إذا كانت البيانات غير كافية في نقطة ما، اذكر ذلك كاستنتاج محدود لا كحقيقة.
- لنفس البيانات والفترة يجب أن تكون النتيجة بنفس المنطق والترتيب قدر الإمكان؛ لا تضف تنويعات إبداعية عشوائية.
- لا تحذف أي ملاحظة مهمة: غطِّ الإيرادات، عدد التبرعات، متوسط التبرع، المتبرعين، المتبرعين المنتظمين، السلال المتروكة، التحويلات البنكية، الموظفين، المهام، الحملات، والدرجات المركبة.
- استخرج كل نقطة قوة/ضعف/فرصة من مقارنة مباشرة بين أداء الجمعية ومتوسط الجمعيات الأخرى أو من المؤشرات الداخلية.
- التوصيات يجب أن تكون عملية، قابلة للتنفيذ، مرتبة بالأولوية، ومربوطة بسبب واضح من البيانات.
- اكتب بلغة تنفيذية ذكية ومباشرة، بدون حشو.`;

  const userPrompt = `حلّل أداء هذه الجمعية للفترة: منذ البداية
الاسم: ${metrics.org_name}
- الإيرادات: ${metrics.total_donated.toFixed(0)} ر.س (متوسط الأخريات: ${avgRev.toFixed(0)})
- عدد التبرعات: ${metrics.donations_count}
- متوسط التبرع: ${metrics.avg_donation.toFixed(0)} ر.س
- المتبرعون: ${metrics.donors} (منتظمون: ${metrics.recurring_donors})
- السلال المتروكة: ${metrics.abandoned_carts} (مسترجعة: ${metrics.recovered_carts}, نسبة: ${metrics.recovery_rate.toFixed(1)}%)
- التحويلات البنكية: ${metrics.bank_transfers} (مطابقة: ${metrics.matched_transfers})
- الموظفون: ${metrics.employees_count}
- المهام: ${metrics.tasks_total} (مكتمل: ${metrics.tasks_completed}, نسبة: ${metrics.task_completion_rate.toFixed(1)}%)
- الحملات: ${metrics.campaigns}
- نقاط (0-100): جمع التبرعات ${metrics.fundraising_score.toFixed(0)} / تفاعل ${metrics.donor_engagement_score.toFixed(0)} / خدمة ${metrics.service_score.toFixed(0)} / فريق ${metrics.team_score.toFixed(0)} / إجمالي ${metrics.overall_score.toFixed(0)} (متوسط الأخريات ${avgScore.toFixed(0)})

قدّم تحليلاً شاملاً يتضمن:
1) ملخّص تنفيذي يغطي أهم الاستنتاجات ولا يتجاوز 4 جمل.
2) 4-6 نقاط قوة، مع عدم تجاهل أي مؤشر إيجابي واضح.
3) 4-6 نقاط ضعف أو مخاطر تشغيلية/تسويقية، مع عدم تجاهل أي مؤشر سلبي واضح.
4) 3-5 فرص نمو وتحسين مستندة إلى البيانات.
5) 6-8 توصيات قابلة للتنفيذ مع مستوى التأثير، مرتبة من الأعلى أثرًا إلى الأقل.
راجع إجابتك داخليًا قبل الإرسال للتأكد من الشمول والدقة والثبات وعدم وجود نقص أو أخطاء.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0,
      top_p: 0.1,
      seed: 42,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_analysis",
          description: "Submit the structured analysis",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "ملخّص تنفيذي 2-4 جمل" },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              opportunities: { type: "array", items: { type: "string" } },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    impact: { type: "string", enum: ["high", "medium", "low"] },
                    action: { type: "string" },
                  },
                  required: ["title", "impact", "action"],
                },
              },
            },
            required: ["summary", "strengths", "weaknesses", "opportunities", "recommendations"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_analysis" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("generate-action-plan insight generation failed:", response.status, text);
    throw new Error("تعذّر توليد التحليل الذكي التلقائي لهذه الجمعية");
  }

  const data = await response.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const insight = args ? JSON.parse(args) : null;
  if (!insight) throw new Error("تعذّر استخراج التحليل الذكي التلقائي");

  const { data: saved, error: saveErr } = await admin
    .from("admin_ai_insights_cache")
    .insert({
      organization_id: metrics.org_id,
      period_label: "منذ البداية",
      period_from: null,
      period_to: null,
      insight,
      metrics_snapshot: metrics,
    })
    .select("id, insight, period_label, generated_at")
    .single();

  if (saveErr) throw saveErr;
  return saved;
}

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
    let { data: cached } = await admin
      .from("admin_ai_insights_cache")
      .select("id, insight, period_label, generated_at")
      .eq("organization_id", organization_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cached?.insight) {
      const allMetrics = await buildOrgMetrics(admin);
      const selectedMetrics = allMetrics.find((m) => m.org_id === organization_id);

      if (!selectedMetrics) {
        return new Response(JSON.stringify({ error: "الجمعية المحددة غير موجودة" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      cached = await generateInsight(admin, LOVABLE_API_KEY, selectedMetrics, allMetrics);
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

    // 3) Ask AI to assign + schedule + break down into executive subtasks
    //    Each subtask gets its own assigned employee + a ready-to-use deliverable.
    let assignments: {
      recommendation_index: number;
      employee_id: string | null;
      reason: string;
      subtasks: {
        title: string;
        details: string;
        duration_days: number;
        assigned_employee_id?: string | null;
        deliverable?: {
          type: "donor_list" | "message_template" | "social_post" | "report_form" | "instructions";
          title: string;
          content: string;
          fields?: { label: string; key: string }[];
        };
      }[];
    }[] = [];
    if (empList.length > 0) {
      const sysPrompt = `أنت مدير تنفيذي خبير. الجمعية تملك بالفعل قاعدة بيانات متبرعين، فريق عمل، وأدوات تواصل. مهمتك أن تجهّز كل شيء بحيث يكون الموظف منفّذًا فقط (لا يفكر، لا يبني من الصفر).

لكل توصية:
1) اختر "المسؤول الأول" من قائمة الموظفين (للإشراف العام) واذكر سببًا موجزًا.
2) فكّك التوصية إلى 4-7 مهام تنفيذية دقيقة، بترتيب زمني منطقي.

لكل مهمة تنفيذية:
- title: يبدأ بفعل أمر محدد (مثال: "أرسل رسالة الواتساب الجاهزة لقائمة المتبرعين المرفقة").
- details: شرح موجز جدًا (سطر أو سطرين) لما سيقوم به الموظف فعليًا.
- duration_days: 1-15.
- assigned_employee_id: اختر الموظف الأنسب لهذه المهمة بالذات (حسب job_role/department؛ الاتصال للعلاقات العامة، التصميم/النشر للتسويق، التقارير المالية للمحاسبة...). لا تترك المهمة بدون موظف.
- deliverable: مخرج جاهز يستخدمه الموظف مباشرة. اختر النوع المناسب:
  * "donor_list": قائمة شريحة مانحين محددة من قاعدة البيانات (مثال: "المانحون غير النشطين منذ 6 أشهر، مرتبون حسب أعلى تبرع سابق"). content = وصف تشغيلي دقيق للشريحة (المعايير).
  * "message_template": نص رسالة واتساب/SMS/بريد جاهز للنسخ مع متغيرات بين قوسين {الاسم} {آخر_تبرع}. content = الرسالة كاملة بدون أي مكان فارغ يحتاج تفكير.
  * "social_post": منشور سوشيال ميديا جاهز (نص + هاشتاقات + اقتراح بصري). content = المنشور النهائي.
  * "report_form": نموذج تقرير قابل للتعبئة. content = تعليمات مختصرة، fields = قائمة الحقول المطلوبة.
  * "instructions": تعليمات تنفيذية واضحة عندما لا ينطبق ما سبق. content = خطوات مرقّمة.
- title (داخل deliverable): اسم المخرج (مثال: "رسالة استرجاع المانحين غير النشطين").

قواعد:
- لا تطلب من الموظف "بناء" أو "إعداد قائمة" — أنت من يحدد القائمة، هو ينفذ فقط.
- لا تخترع أرقامًا أو معلومات غير مذكورة في البيانات.
- استخدم العربية الاحترافية المباشرة.`;
      const userPrompt = `الموظفون المتاحون:\n${JSON.stringify(empList, null, 2)}\n\nالتوصيات:\n${recs.map((r, i) => `${i}) [${r.impact}] ${r.title}\n   الإجراء: ${r.action}`).join("\n\n")}`;

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
              description: "Assign each recommendation to the most suitable employee and break it into executive subtasks",
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
                        subtasks: {
                          type: "array",
                          minItems: 4,
                          maxItems: 7,
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string", description: "فعل أمر محدد للموظف" },
                              details: { type: "string", description: "شرح موجز سطر أو سطرين" },
                              duration_days: { type: "number", description: "1-15" },
                              assigned_employee_id: { type: "string", description: "id الموظف المنفّذ لهذه المهمة" },
                              deliverable: {
                                type: "object",
                                properties: {
                                  type: { type: "string", enum: ["donor_list", "message_template", "social_post", "report_form", "instructions"] },
                                  title: { type: "string" },
                                  content: { type: "string" },
                                  fields: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        label: { type: "string" },
                                        key: { type: "string" },
                                      },
                                      required: ["label", "key"],
                                    },
                                  },
                                },
                                required: ["type", "title", "content"],
                              },
                            },
                            required: ["title", "details", "duration_days", "assigned_employee_id", "deliverable"],
                          },
                        },
                      },
                      required: ["recommendation_index", "employee_id", "reason", "subtasks"],
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
        subtasks: a?.subtasks || [],
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