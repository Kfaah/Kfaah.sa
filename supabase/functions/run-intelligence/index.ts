// Edge Function: run-intelligence
// محرك CRM الذكي: يستقرئ كل بيانات الجمعية، يولّد رؤى عميقة،
// مهام شكر/ذكريات/استرداد/متابعة، وأفكار تسويقية إبداعية،
// ثم يخزّنها في donor_insights / smart_tasks / marketing_ideas / donor_lifecycle_events.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_URL = (Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions");
const DEFAULT_MODEL = "google/gemini-2.5-flash";

interface RunRequest {
  organizationId?: string;
  triggerSource?: "manual" | "upload" | "scheduled";
  uploadId?: string;
  scope?: string[]; // optional list e.g. ["donors","campaigns","gifts"]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function sameMonthDay(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ===== استدعاء الذكاء مع structured tool calling =====
async function callAI(systemPrompt: string, userPrompt: string, tool: any, model = DEFAULT_MODEL) {
  const apiKey = Deno.env.get("KFAAH_AI_API_KEY");
  if (!apiKey) throw new Error("KFAAH_AI_API_KEY missing");

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no tool call");
  return JSON.parse(args);
}

// ===== Schemas للأدوات =====
const insightsTool = {
  type: "function",
  function: {
    name: "emit_insights",
    description: "Emit deep CRM insights about donors, campaigns, projects, retention, and opportunities.",
    parameters: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              insight_type: { type: "string", enum: ["donor_pattern","campaign_performance","segment_analysis","retention_risk","opportunity","trend"] },
              category: { type: "string", enum: ["donors","campaigns","projects","gifts","subscriptions","general"] },
              severity: { type: "string", enum: ["critical","high","medium","low","info"] },
              title: { type: "string" },
              summary: { type: "string" },
              recommended_actions: { type: "array", items: { type: "string" } },
            },
            required: ["insight_type","category","severity","title","summary","recommended_actions"],
            additionalProperties: false,
          },
        },
      },
      required: ["insights"],
      additionalProperties: false,
    },
  },
};

const ideasTool = {
  type: "function",
  function: {
    name: "emit_marketing_ideas",
    description: "Emit creative marketing ideas (campaigns, posts, storytelling, segments).",
    parameters: {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              idea_type: { type: "string", enum: ["campaign","social_post","donor_segment","storytelling","seasonal","content_series"] },
              title: { type: "string" },
              description: { type: "string" },
              target_segment: { type: "string" },
              channels: { type: "array", items: { type: "string" } },
              expected_impact: { type: "string" },
              effort_level: { type: "string", enum: ["low","medium","high"] },
              content_draft: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } },
            },
            required: ["idea_type","title","description","target_segment","channels","expected_impact","effort_level","content_draft","hashtags"],
            additionalProperties: false,
          },
        },
      },
      required: ["ideas"],
      additionalProperties: false,
    },
  },
};

const messageTool = {
  type: "function",
  function: {
    name: "emit_outreach_message",
    description: "Generate a warm, personalized Arabic outreach message for a donor.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "نص الرسالة بالعربية، قصير مؤثر يخاطب المتبرع باسمه" },
        channel: { type: "string", enum: ["whatsapp","sms","email","call"] },
      },
      required: ["message","channel"],
      additionalProperties: false,
    },
  },
};

// ===== جلب البيانات =====
async function loadDataset(admin: any, orgId: string) {
  const orgFilter = (q: any) => q.eq("organization_id", orgId);
  const sixMonths = monthsAgo(6);

  const [donorsR, donationsR, campaignsR, giftsR, subsR, abandR, failedR] = await Promise.all([
    orgFilter(admin.from("donors").select("id,full_name,phone,segment,total_donated,donations_count,first_donation_at,last_donation_at,city").order("total_donated",{ascending:false})).limit(200),
    orgFilter(admin.from("donations").select("id,donor_id,donor_name,amount,donation_date,project_name,payment_method,status").gte("donation_date", sixMonths)).limit(2000),
    orgFilter(admin.from("campaigns").select("id,name,goal_amount,collected_amount,donations_count,start_date,end_date,status")).limit(100),
    orgFilter(admin.from("gifts").select("id,giver_name,recipient_name,amount,occasion,gift_date,delivery_status").gte("gift_date", sixMonths)).limit(500),
    orgFilter(admin.from("subscriptions").select("id,donor_name,amount,status,start_date,end_date,next_charge_date,cancellation_reason")).limit(500),
    orgFilter(admin.from("abandoned_carts").select("id,donor_name,donor_phone,amount,project_name,follow_up_status,abandoned_at,recovered").eq("recovered",false).gte("abandoned_at", daysAgo(30))).limit(300),
    orgFilter(admin.from("failed_donations").select("id,donor_name,donor_phone,amount,project_name,failure_reason,attempted_at,retry_status").gte("attempted_at", daysAgo(30))).limit(300),
  ]);

  return {
    donors: donorsR.data ?? [],
    donations: donationsR.data ?? [],
    campaigns: campaignsR.data ?? [],
    gifts: giftsR.data ?? [],
    subscriptions: subsR.data ?? [],
    abandoned: abandR.data ?? [],
    failed: failedR.data ?? [],
  };
}

// ===== كشف أحداث دورة حياة المتبرع =====
function detectLifecycleEvents(ds: any) {
  const events: any[] = [];
  const today = new Date();

  // 1) ذكرى تبرع: نفس اليوم/الشهر من سنة سابقة
  for (const d of ds.donations) {
    if (!d.donation_date || !d.donor_id) continue;
    const dt = new Date(d.donation_date);
    if (dt.getFullYear() < today.getFullYear() && sameMonthDay(dt, today)) {
      events.push({
        donor_id: d.donor_id,
        event_type: "donation_anniversary",
        event_date: todayISO(),
        amount: d.amount,
        metadata: { original_date: d.donation_date, project: d.project_name, donor_name: d.donor_name },
      });
    }
  }

  // 2) متبرع كبير: تجاوز عتبة 5000
  for (const donor of ds.donors) {
    if ((donor.total_donated ?? 0) >= 5000 && donor.last_donation_at) {
      const last = new Date(donor.last_donation_at);
      const diffDays = (today.getTime() - last.getTime()) / 86400000;
      if (diffDays <= 7) {
        events.push({
          donor_id: donor.id,
          event_type: "milestone_amount",
          event_date: todayISO(),
          amount: donor.total_donated,
          metadata: { donor_name: donor.full_name, segment: donor.segment },
        });
      }
    }
  }

  // 3) متبرعون منقطعون (lapsing): آخر تبرع 90-180 يوماً
  for (const donor of ds.donors) {
    if (!donor.last_donation_at) continue;
    const last = new Date(donor.last_donation_at);
    const diffDays = (today.getTime() - last.getTime()) / 86400000;
    if (diffDays >= 90 && diffDays <= 180 && (donor.donations_count ?? 0) >= 2) {
      events.push({
        donor_id: donor.id,
        event_type: "lapsing",
        event_date: todayISO(),
        amount: donor.total_donated,
        metadata: { donor_name: donor.full_name, days_inactive: Math.floor(diffDays) },
      });
    }
  }

  // 4) اشتراكات ملغاة حديثاً
  for (const s of ds.subscriptions) {
    if (s.status === "cancelled" && s.end_date) {
      const ed = new Date(s.end_date);
      const diff = (today.getTime() - ed.getTime()) / 86400000;
      if (diff <= 7) {
        events.push({
          donor_id: null,
          event_type: "subscription_cancelled",
          event_date: todayISO(),
          amount: s.amount,
          metadata: { donor_name: s.donor_name, reason: s.cancellation_reason },
        });
      }
    }
  }

  return events;
}

// ===== تحويل الأحداث إلى مهام ذكية =====
async function eventsToTasks(admin: any, orgId: string, events: any[]) {
  const tasks: any[] = [];
  for (const ev of events) {
    let task: any = {
      organization_id: orgId,
      ai_generated: true,
      ai_model: DEFAULT_MODEL,
      related_donor_id: ev.donor_id,
      due_date: todayISO(),
      context: ev.metadata,
      priority: "medium",
      category: "crm",
    };
    switch (ev.event_type) {
      case "donation_anniversary":
        task.task_type = "anniversary";
        task.title = `ذكرى تبرع: ${ev.metadata?.donor_name || "متبرع"} في مثل هذا اليوم`;
        task.description = `في مثل هذا اليوم تبرع ${ev.metadata?.donor_name || "المتبرع"} بمبلغ ${ev.amount} ريال لمشروع "${ev.metadata?.project || ""}". وقت مناسب للتواصل والشكر.`;
        task.suggested_channel = "whatsapp";
        task.priority = "medium";
        break;
      case "milestone_amount":
        task.task_type = "thank_you";
        task.title = `متبرع كبير: ${ev.metadata?.donor_name}`;
        task.description = `بلغ إجمالي تبرعات ${ev.metadata?.donor_name} مبلغ ${ev.amount} ريال. يستحق تقديراً خاصاً وعلاقة استراتيجية.`;
        task.suggested_channel = "call";
        task.priority = "high";
        break;
      case "lapsing":
        task.task_type = "reactivation";
        task.title = `متبرع على وشك الانقطاع: ${ev.metadata?.donor_name}`;
        task.description = `لم يتبرع ${ev.metadata?.donor_name} منذ ${ev.metadata?.days_inactive} يوماً. حملة إعادة تفعيل شخصية موصى بها.`;
        task.suggested_channel = "whatsapp";
        task.priority = "high";
        break;
      case "subscription_cancelled":
        task.task_type = "follow_up";
        task.title = `إلغاء اشتراك: ${ev.metadata?.donor_name}`;
        task.description = `ألغى ${ev.metadata?.donor_name} اشتراكه (${ev.metadata?.reason || "بدون سبب محدد"}). تواصل لمعرفة السبب وعرض بديل.`;
        task.suggested_channel = "call";
        task.priority = "high";
        break;
    }
    if (task.task_type) tasks.push({ task, event: ev });
  }
  return tasks;
}

// ===== مهام السلال المتروكة والمحاولات الفاشلة =====
function recoveryTasks(orgId: string, ds: any) {
  const tasks: any[] = [];
  for (const c of ds.abandoned.slice(0, 30)) {
    if (c.follow_up_status !== "pending") continue;
    tasks.push({
      organization_id: orgId,
      task_type: "recovery",
      category: "recovery",
      priority: "high",
      title: `استرداد سلة: ${c.donor_name || "متبرع"} - ${c.amount} ريال`,
      description: `ترك ${c.donor_name || "متبرع"} سلة تبرع لمشروع "${c.project_name || ""}" بمبلغ ${c.amount} ريال. تواصل سريع لإكمال التبرع.`,
      suggested_channel: "whatsapp",
      due_date: todayISO(),
      context: { phone: c.donor_phone, amount: c.amount, project: c.project_name, abandoned_at: c.abandoned_at },
      ai_generated: true,
      ai_model: DEFAULT_MODEL,
    });
  }
  for (const f of ds.failed.slice(0, 20)) {
    if (f.retry_status !== "pending") continue;
    tasks.push({
      organization_id: orgId,
      task_type: "recovery",
      category: "recovery",
      priority: "high",
      title: `محاولة فاشلة: ${f.donor_name || "متبرع"} - ${f.amount} ريال`,
      description: `فشل تبرع ${f.donor_name || "المتبرع"} (${f.failure_reason || "سبب غير معروف"}). تواصل لمساعدته على إكمال العملية.`,
      suggested_channel: "whatsapp",
      due_date: todayISO(),
      context: { phone: f.donor_phone, amount: f.amount, project: f.project_name, reason: f.failure_reason },
      ai_generated: true,
      ai_model: DEFAULT_MODEL,
    });
  }
  return tasks;
}

// ===== ملخص بيانات لتزويد الذكاء =====
function summarizeForAI(ds: any) {
  const totalDonated = ds.donations.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
  const avgGift = ds.donations.length ? Math.round(totalDonated / ds.donations.length) : 0;
  const projectMap: Record<string, number> = {};
  for (const d of ds.donations) {
    const k = d.project_name || "غير محدد";
    projectMap[k] = (projectMap[k] || 0) + Number(d.amount || 0);
  }
  const topProjects = Object.entries(projectMap).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
  const topDonors = ds.donors.slice(0, 10).map((d: any) => ({ name: d.full_name, total: d.total_donated, count: d.donations_count, segment: d.segment }));
  const lapsingCount = ds.donors.filter((d: any) => {
    if (!d.last_donation_at) return false;
    const days = (Date.now() - new Date(d.last_donation_at).getTime()) / 86400000;
    return days >= 90 && days <= 180;
  }).length;
  const churnedCount = ds.donors.filter((d: any) => {
    if (!d.last_donation_at) return false;
    const days = (Date.now() - new Date(d.last_donation_at).getTime()) / 86400000;
    return days > 180;
  }).length;
  const activeCampaigns = ds.campaigns.filter((c: any) => c.status === "active").length;
  const stuckCampaigns = ds.campaigns.filter((c: any) => c.goal_amount && (c.collected_amount / c.goal_amount) < 0.3 && c.status === "active");

  return {
    period: "آخر 6 أشهر",
    totals: {
      donations_count: ds.donations.length,
      total_donated: totalDonated,
      avg_gift: avgGift,
      donors_count: ds.donors.length,
      gifts_count: ds.gifts.length,
      active_subscriptions: ds.subscriptions.filter((s: any) => s.status === "active").length,
      abandoned_carts_pending: ds.abandoned.length,
      failed_donations_pending: ds.failed.length,
    },
    top_projects: topProjects.map(([name, total]) => ({ name, total })),
    top_donors: topDonors,
    retention: { lapsing: lapsingCount, churned: churnedCount },
    campaigns: { active: activeCampaigns, stuck_below_30pct: stuckCampaigns.map((c: any) => ({ name: c.name, progress: Math.round(((c.collected_amount || 0) / (c.goal_amount || 1)) * 100) })) },
  };
}

// ===== تشغيل الذكاء لتوليد رؤى =====
async function generateInsights(summary: any) {
  const sys = `أنت محلل CRM خبير في القطاع الخيري السعودي. مهمتك استخراج رؤى عميقة، دقيقة، قابلة للتنفيذ من بيانات الجمعية. اكتب بالعربية الفصيحة الموجزة. ركّز على: علاقات المتبرعين الكبار، فرص الاستثمار في البيانات، مخاطر الانقطاع، أداء الحملات، تقاطعات بين المشاريع. كن مباشراً غير عمومي.`;
  const user = `حلّل بيانات الجمعية التالية واستخرج 6-10 رؤى عميقة متنوعة (ليس عمومية) مع توصيات عملية:\n\n${JSON.stringify(summary, null, 2)}`;
  return await callAI(sys, user, insightsTool);
}

// ===== توليد أفكار تسويقية =====
async function generateMarketingIdeas(summary: any) {
  const sys = `أنت مدير تسويق إبداعي للجمعيات الخيرية في السعودية. تجيد توليد أفكار غير مسبوقة في Social Media (سناب، تويتر/X، انستقرام، تيك توك). تربط الأفكار ببيانات حقيقية. تكتب بالعربية بأسلوب جذاب يلامس الوجدان السعودي.`;
  const user = `بناءً على بيانات الجمعية، اقترح 5-7 أفكار تسويقية إبداعية متنوعة (حملة، منشور، شريحة، storytelling، موسمي). كل فكرة بمسودة محتوى جاهزة للنشر:\n\n${JSON.stringify(summary, null, 2)}`;
  return await callAI(sys, user, ideasTool);
}

// ===== توليد رسائل شكر مخصصة (للمتبرعين الكبار فقط لتوفير التكلفة) =====
async function generateMessage(donorName: string, context: string) {
  const sys = `أنت كاتب رسائل شكر للمتبرعين في جمعية خيرية. اكتب رسائل قصيرة دافئة شخصية بالعربية الفصيحة. لا تستخدم عبارات عامة. اربط بسياق التبرع.`;
  const user = `اكتب رسالة لـ ${donorName}. السياق: ${context}`;
  try {
    return await callAI(sys, user, messageTool);
  } catch {
    return null;
  }
}

// ===== الدالة الرئيسية =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body: RunRequest = await req.json().catch(() => ({}));
    let { organizationId, triggerSource = "manual", uploadId } = body;

    // استخراج المستخدم وorgId إذا لم يُمرر
    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: u } = await userClient.auth.getUser();
      userId = u.user?.id ?? null;
      if (!organizationId && userId) {
        const { data: orgRow } = await admin
          .from("user_organizations")
          .select("organization_id")
          .eq("user_id", userId)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        organizationId = orgRow?.organization_id;
      }
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // إنشاء سجل run
    const { data: run } = await admin
      .from("analysis_runs")
      .insert({
        organization_id: organizationId,
        triggered_by: userId,
        trigger_source: triggerSource,
        upload_id: uploadId,
        status: "running",
        ai_model: DEFAULT_MODEL,
      })
      .select()
      .single();

    // 1) جلب البيانات
    const ds = await loadDataset(admin, organizationId);
    const summary = summarizeForAI(ds);

    // 2) كشف أحداث دورة الحياة + توليد المهام منها
    const events = detectLifecycleEvents(ds);
    let insertedEvents = 0;
    if (events.length) {
      const evWithOrg = events.map((e) => ({ ...e, organization_id: organizationId }));
      const { data: insEv } = await admin.from("donor_lifecycle_events").insert(evWithOrg).select();
      insertedEvents = insEv?.length ?? 0;
    }

    const lifecycleTaskPairs = await eventsToTasks(admin, organizationId, events);
    const recoveryT = recoveryTasks(organizationId, ds);

    // 3) توليد رسائل ذكية لأهم 5 مهام (لتوفير التكلفة)
    const lifecycleTasks = lifecycleTaskPairs.map((p: any) => p.task);
    const allTasks = [...lifecycleTasks, ...recoveryT];
    for (let i = 0; i < Math.min(5, allTasks.length); i++) {
      const t = allTasks[i];
      if (t.task_type === "thank_you" || t.task_type === "anniversary" || t.priority === "high") {
        const donorName = t.context?.donor_name || t.context?.donor_id || "المتبرع الكريم";
        const ctx = `${t.title}. ${t.description}`;
        const msg = await generateMessage(donorName, ctx);
        if (msg) {
          t.suggested_message = msg.message;
          t.suggested_channel = msg.channel;
        }
      }
    }

    // 4) إدراج المهام
    let insertedTasks = 0;
    if (allTasks.length) {
      const { data: insT } = await admin.from("smart_tasks").insert(allTasks).select();
      insertedTasks = insT?.length ?? 0;
    }

    // 5) توليد رؤى ذكية + أفكار تسويقية بالتوازي
    let insertedInsights = 0;
    let insertedIdeas = 0;
    try {
      const [insightsResult, ideasResult] = await Promise.all([
        generateInsights(summary),
        generateMarketingIdeas(summary),
      ]);

      if (insightsResult?.insights?.length) {
        const rows = insightsResult.insights.map((i: any) => ({
          organization_id: organizationId,
          insight_type: i.insight_type,
          category: i.category,
          severity: i.severity,
          title: i.title,
          summary: i.summary,
          recommended_actions: i.recommended_actions,
          metrics: summary.totals,
          ai_model: DEFAULT_MODEL,
        }));
        const { data: insIn } = await admin.from("donor_insights").insert(rows).select();
        insertedInsights = insIn?.length ?? 0;
      }

      if (ideasResult?.ideas?.length) {
        const rows = ideasResult.ideas.map((i: any) => ({
          organization_id: organizationId,
          idea_type: i.idea_type,
          title: i.title,
          description: i.description,
          target_segment: i.target_segment,
          channels: i.channels,
          expected_impact: i.expected_impact,
          effort_level: i.effort_level,
          content_draft: i.content_draft,
          hashtags: i.hashtags,
          data_basis: { period: summary.period, totals: summary.totals },
          ai_model: DEFAULT_MODEL,
        }));
        const { data: insId } = await admin.from("marketing_ideas").insert(rows).select();
        insertedIdeas = insId?.length ?? 0;
      }
    } catch (aiErr) {
      console.error("AI generation error", aiErr);
    }

    // 6) إنهاء الـ run
    const duration = Date.now() - startTime;
    await admin
      .from("analysis_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        insights_generated: insertedInsights,
        tasks_generated: insertedTasks,
        ideas_generated: insertedIdeas,
        events_detected: insertedEvents,
        summary: `تم توليد ${insertedInsights} رؤية، ${insertedTasks} مهمة، ${insertedIdeas} فكرة تسويقية، و${insertedEvents} حدث.`,
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        runId: run.id,
        insights: insertedInsights,
        tasks: insertedTasks,
        ideas: insertedIdeas,
        events: insertedEvents,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("run-intelligence error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
