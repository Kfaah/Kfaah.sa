// Daily Donor Intelligence Engine
// Runs deep behavioral analysis on donations + subscriptions + campaigns
// + gifts + abandoned carts + failed donations, then asks Lovable AI to
// generate insights, creative ideas, and ready-to-assign smart tasks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `أنت كبير محلّلي البيانات وخبير تنمية الموارد لجمعية خيرية في السوق السعودي.
تستلم لقطة سلوكية ذكية مجمّعة عن المتبرعين والحملات والاستقطاعات والإهداءات والسلال المتروكة.

مهمتك: إنتاج تحليل عميق غير مسبوق، يربط بين أنشطة المتبرع المختلفة، ويولّد:
1) ملخّص يومي راقٍ.
2) رؤى دقيقة لكل فئة سلوكية، كل رؤية تشير إلى متبرع/حملة/مجموعة محددة بسياق رقمي.
3) مهام قابلة للتنفيذ فوراً للموظفين، بصياغة عربية احترافية ودقيقة.
4) أفكار حملات/محتوى إبداعية مبتكرة.
5) أبرز الأرقام اللافتة لليوم.

اكتب بأسلوب راقٍ، لا تستخدم كليشيهات، اربط الأنشطة ببعضها بطرق ذكية،
واقترح إجراءات مبدعة وعملية في آن واحد. كل مهمة يجب أن تشمل لمن (متبرع/حملة)،
ولماذا الآن، وكيف تنفّذ، وما الأثر المتوقع.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "daily_intelligence_report",
    description: "تقرير ذكاء يومي شامل للتبرعات",
    parameters: {
      type: "object",
      properties: {
        daily_brief: { type: "string", description: "ملخّص اليوم في 4-6 جمل بأسلوب راقٍ" },
        kpi_highlights: {
          type: "array",
          description: "أبرز 4-6 أرقام لافتة لليوم",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "string" },
              hint: { type: "string", description: "تفسير قصير" },
            },
            required: ["label", "value", "hint"],
          },
        },
        insights: {
          type: "array",
          description: "10-20 رؤية سلوكية دقيقة",
          items: {
            type: "object",
            properties: {
              insight_type: {
                type: "string",
                enum: [
                  "donation_anniversary",
                  "first_gift_window",
                  "lapsing_recurring",
                  "campaign_near_goal",
                  "abandoned_cart_recovery",
                  "cross_activity_donor",
                  "upgrade_opportunity",
                  "loss_risk",
                  "project_loyalty",
                  "generous_gift_giver",
                  "other",
                ],
              },
              category: { type: "string", description: "تصنيف عام: retention | growth | recovery | celebration | risk" },
              severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
              title: { type: "string" },
              summary: { type: "string", description: "شرح مختصر مع أرقام" },
              donor_ref: { type: "string", description: "اسم/معرّف المتبرع أو المجموعة المعنية" },
              recommended_actions: {
                type: "array",
                items: { type: "string" },
                description: "2-4 إجراءات مقترحة موجزة",
              },
            },
            required: ["insight_type", "category", "severity", "title", "summary", "recommended_actions"],
          },
        },
        suggested_tasks: {
          type: "array",
          description: "5-15 مهمة جاهزة للإسناد لموظفي التبرعات والتسويق",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "عنوان واضح ≤ 80 حرفًا" },
              description: { type: "string", description: "تفصيل المهمة، السياق، الخطوات، الأثر المتوقع" },
              category: { type: "string", description: "متابعة | استرداد | شكر | ترقية | حملة | محتوى" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              due_in_days: { type: "number", description: "كم يومًا حتى الموعد (0 = اليوم)" },
              donor_ref: { type: "string" },
              suggested_message: { type: "string", description: "نص رسالة جاهز للإرسال (اختياري)" },
              channel: { type: "string", description: "whatsapp | sms | email | call | visit" },
            },
            required: ["title", "description", "category", "priority", "due_in_days"],
          },
        },
        creative_ideas: {
          type: "array",
          description: "4-7 أفكار حملات/محتوى مبتكرة مرتبطة بالبيانات",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "description"],
          },
        },
      },
      required: ["daily_brief", "kpi_highlights", "insights", "suggested_tasks", "creative_ideas"],
      additionalProperties: false,
    },
  },
};

function normName(s: any): string {
  if (!s) return "";
  return String(s).trim().replace(/\s+/g, " ").toLowerCase();
}
function donorKey(row: any, nameField = "donor_name", phoneField = "donor_phone", idField = "donor_id") {
  return row?.[idField] || (row?.[phoneField] ? `p:${String(row[phoneField]).replace(/\D+/g, "")}` : null) || (row?.[nameField] ? `n:${normName(row[nameField])}` : null);
}

async function buildSignals(supa: any, orgId: string) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const since30 = new Date(today.getTime() - 30 * 86400000).toISOString();
  const since90 = new Date(today.getTime() - 90 * 86400000).toISOString();
  const since72h = new Date(today.getTime() - 72 * 3600000).toISOString();

  const [donations, donors, subs, campaigns, gifts, carts, failed] = await Promise.all([
    supa.from("donations").select("id,donor_id,donor_name,donor_phone,project_name,amount,donation_date,status").eq("organization_id", orgId).limit(20000),
    supa.from("donors").select("id,full_name,phone,segment,total_donated,donations_count,first_donation_at,last_donation_at").eq("organization_id", orgId).limit(20000),
    supa.from("subscriptions").select("id,donor_id,donor_name,donor_phone,amount,project_name,status,start_date,next_charge_date").eq("organization_id", orgId).limit(10000),
    supa.from("campaigns").select("id,name,goal_amount,collected_amount,donations_count,status,end_date").eq("organization_id", orgId).limit(2000),
    supa.from("gifts").select("id,giver_donor_id,giver_name,giver_phone,amount,project_name,gift_date").eq("organization_id", orgId).gte("gift_date", since90).limit(5000),
    supa.from("abandoned_carts").select("id,donor_id,donor_name,donor_phone,amount,project_name,abandoned_at,follow_up_status,recovered").eq("organization_id", orgId).gte("abandoned_at", since72h).limit(5000),
    supa.from("failed_donations").select("id,donor_id,donor_name,donor_phone,amount,project_name,attempted_at,failure_reason").eq("organization_id", orgId).gte("attempted_at", since30).limit(5000),
  ]);

  const D = donations.data || [];
  const DR = donors.data || [];
  const SU = subs.data || [];
  const CM = campaigns.data || [];
  const GF = gifts.data || [];
  const AC = carts.data || [];
  const FD = failed.data || [];

  // ذكرى تبرع: تبرعات في نفس اليوم/الشهر من سنوات سابقة
  const anniversaries: any[] = [];
  for (const d of D) {
    const date = new Date(d.donation_date);
    const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (md === monthDay && date.getFullYear() < today.getFullYear()) {
      anniversaries.push({
        donor: d.donor_name, phone: d.donor_phone ? String(d.donor_phone).slice(-4) : null,
        years_ago: today.getFullYear() - date.getFullYear(), amount: Number(d.amount), project: d.project_name,
      });
    }
  }

  // أعياد العطاء: أول تبرع لهم آخر 7 أيام
  const since7 = new Date(today.getTime() - 7 * 86400000);
  const firstGifts = DR.filter((d: any) => d.first_donation_at && new Date(d.first_donation_at) >= since7).map((d: any) => ({
    donor: d.full_name, total: Number(d.total_donated), count: d.donations_count,
  }));

  // حملات قاب قوسين
  const nearGoal = CM.filter((c: any) => c.goal_amount && Number(c.collected_amount) / Number(c.goal_amount) >= 0.8 && Number(c.collected_amount) < Number(c.goal_amount)).map((c: any) => ({
    name: c.name, goal: Number(c.goal_amount), collected: Number(c.collected_amount),
    pct: Math.round((Number(c.collected_amount) / Number(c.goal_amount)) * 100),
    donations_count: c.donations_count,
  }));

  // سلال متروكة في النافذة الذهبية
  const goldenCarts = AC.filter((c: any) => !c.recovered && c.follow_up_status !== "recovered").slice(0, 30).map((c: any) => ({
    donor: c.donor_name, amount: Number(c.amount || 0), project: c.project_name, abandoned_at: c.abandoned_at,
  }));

  // متذبذبون: مستقطع status active لكن next_charge_date متجاوز
  const lapsing = SU.filter((s: any) => s.status === "active" && s.next_charge_date && new Date(s.next_charge_date) < since7).map((s: any) => ({
    donor: s.donor_name, amount: Number(s.amount), missed_since: s.next_charge_date,
  })).slice(0, 30);

  // فرص ترقية: مستقطع نشط ≥6 أشهر
  const sixMonthsAgo = new Date(today.getTime() - 180 * 86400000);
  const upgrade = SU.filter((s: any) => s.status === "active" && s.start_date && new Date(s.start_date) <= sixMonthsAgo).map((s: any) => ({
    donor: s.donor_name, amount: Number(s.amount), since: s.start_date,
  })).slice(0, 20);

  // مخاطر فقدان: تبرعات فاشلة متكررة
  const failedByDonor = new Map<string, any[]>();
  for (const f of FD) {
    const k = donorKey(f);
    if (!k) continue;
    if (!failedByDonor.has(k)) failedByDonor.set(k, []);
    failedByDonor.get(k)!.push(f);
  }
  const lossRisk = Array.from(failedByDonor.entries()).filter(([_, list]) => list.length >= 2).slice(0, 20).map(([_, list]) => ({
    donor: list[0].donor_name, attempts: list.length, last_reason: list[0].failure_reason,
  }));

  // متبرعون عابرون للأنشطة
  const activityMap = new Map<string, { donor: string; donate: number; sub: number; gift: number; cart: number }>();
  for (const d of D) { const k = donorKey(d); if (!k) continue; const e = activityMap.get(k) || { donor: d.donor_name, donate: 0, sub: 0, gift: 0, cart: 0 }; e.donate++; activityMap.set(k, e); }
  for (const s of SU) { const k = donorKey(s); if (!k) continue; const e = activityMap.get(k) || { donor: s.donor_name, donate: 0, sub: 0, gift: 0, cart: 0 }; e.sub++; activityMap.set(k, e); }
  for (const g of GF) { const k = donorKey(g, "giver_name", "giver_phone", "giver_donor_id"); if (!k) continue; const e = activityMap.get(k) || { donor: g.giver_name, donate: 0, sub: 0, gift: 0, cart: 0 }; e.gift++; activityMap.set(k, e); }
  for (const c of AC) { const k = donorKey(c); if (!k) continue; const e = activityMap.get(k) || { donor: c.donor_name, donate: 0, sub: 0, gift: 0, cart: 0 }; e.cart++; activityMap.set(k, e); }
  const cross = Array.from(activityMap.values()).filter((e) => [e.donate, e.sub, e.gift, e.cart].filter((n) => n > 0).length >= 3).slice(0, 25);

  // ولاء مشروع
  const projectByDonor = new Map<string, Map<string, number>>();
  for (const d of D) {
    const k = donorKey(d); if (!k || !d.project_name) continue;
    if (!projectByDonor.has(k)) projectByDonor.set(k, new Map());
    const m = projectByDonor.get(k)!;
    m.set(d.project_name, (m.get(d.project_name) || 0) + 1);
  }
  const loyalty: any[] = [];
  for (const [k, m] of projectByDonor) {
    const top = Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      const sample = D.find((x: any) => donorKey(x) === k);
      loyalty.push({ donor: sample?.donor_name, project: top[0], times: top[1] });
    }
  }

  // مهدون كرماء
  const giftByGiver = new Map<string, any[]>();
  for (const g of GF) {
    const k = donorKey(g, "giver_name", "giver_phone", "giver_donor_id");
    if (!k) continue;
    if (!giftByGiver.has(k)) giftByGiver.set(k, []);
    giftByGiver.get(k)!.push(g);
  }
  const generousGivers = Array.from(giftByGiver.values()).filter((l) => l.length >= 3).slice(0, 20).map((l) => ({
    donor: l[0].giver_name, gifts_count: l.length, total: l.reduce((s, x) => s + Number(x.amount || 0), 0),
  }));

  return {
    today: todayStr,
    totals: {
      donations: D.length,
      donations_amount: D.reduce((s: number, x: any) => s + Number(x.amount || 0), 0),
      donors: DR.length,
      active_subscriptions: SU.filter((s: any) => s.status === "active").length,
      active_campaigns: CM.filter((c: any) => c.status === "active").length,
      gifts_90d: GF.length,
      abandoned_72h: AC.length,
      failed_30d: FD.length,
    },
    signals: {
      anniversaries: anniversaries.slice(0, 30),
      first_gifts_7d: firstGifts.slice(0, 20),
      campaigns_near_goal: nearGoal.slice(0, 15),
      golden_window_carts: goldenCarts,
      lapsing_subscriptions: lapsing,
      upgrade_candidates: upgrade,
      loss_risk_donors: lossRisk,
      cross_activity_donors: cross.slice(0, 25),
      project_loyalty: loyalty.slice(0, 20),
      generous_gift_givers: generousGivers,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) return json({ error: "KFAAH_AI_API_KEY غير مهيّأ" }, 500);

    const body = await req.json().catch(() => ({}));
    const orgId: string | undefined = body.organizationId || body.organization_id;
    const trigger: string = body.trigger || "manual";
    const dataset: string | null = body.dataset || null;
    const callerUserId: string | undefined = body.caller_user_id;

    if (!orgId) return json({ error: "organizationId مطلوب" }, 400);

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const snapshot = await buildSignals(supa, orgId);

    // اطلب من النموذج التحليل
    const userMessage = `لقطة بيانات اليوم (${snapshot.today}) — السبب: ${trigger}${dataset ? " · ملف مرفوع: " + dataset : ""}

الإجماليات:
${JSON.stringify(snapshot.totals, null, 2)}

الإشارات السلوكية:
${JSON.stringify(snapshot.signals, null, 2)}

ولّد تقريرًا كاملاً عبر استدعاء الأداة daily_intelligence_report.
اربط بين الإشارات بذكاء (مثلاً: متبرع له ذكرى اليوم وأيضًا في حملة قاب قوسين → مهمة واحدة مركّبة).
اقترح مهامًا واقعية وقابلة للتنفيذ خلال 1-3 أيام.`;

    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "daily_intelligence_report" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "تم تجاوز حد الطلبات. حاول لاحقًا." }, 429);
    if (aiResp.status === 402) return json({ error: "نفد رصيد Lovable AI. أضف رصيدًا من الإعدادات." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return json({ error: "فشل استدعاء الذكاء الاصطناعي" }, 500);
    }

    const aiData = await aiResp.json();
    const args = aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "استجابة غير متوقعة" }, 500);
    const report = typeof args === "string" ? JSON.parse(args) : args;

    // احفظ الرؤى
    const insightRows = (report.insights || []).map((it: any) => ({
      organization_id: orgId,
      insight_type: it.insight_type || "other",
      category: it.category || "general",
      severity: it.severity || "info",
      title: it.title,
      summary: it.summary,
      details: { donor_ref: it.donor_ref, recommended_actions: it.recommended_actions },
      ai_model: "google/gemini-2.5-pro",
      generated_at: new Date().toISOString(),
    }));

    let insertedInsights: any[] = [];
    if (insightRows.length) {
      const { data, error } = await supa.from("donor_insights").insert(insightRows).select("id,title");
      if (error) console.error("insights insert", error);
      insertedInsights = data || [];
    }

    // احفظ المهام الذكية
    const today = new Date();
    const taskRows = (report.suggested_tasks || []).slice(0, 30).map((t: any, i: number) => {
      const due = new Date(today.getTime() + (Math.max(0, Number(t.due_in_days) || 0)) * 86400000);
      return {
        organization_id: orgId,
        task_type: t.category || "follow_up",
        category: t.category || "متابعة",
        priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
        title: String(t.title).slice(0, 200),
        description: t.description,
        context: { donor_ref: t.donor_ref, channel: t.channel, source_trigger: trigger, dataset },
        suggested_message: t.suggested_message || null,
        suggested_channel: t.channel || null,
        due_date: due.toISOString().slice(0, 10),
        status: "pending",
        ai_generated: true,
        ai_model: "google/gemini-2.5-pro",
        source_insight_id: insertedInsights[i]?.id || null,
        assigned_to: callerUserId || null,
      };
    });

    let insertedTasks = 0;
    if (taskRows.length) {
      const { error, count } = await supa.from("smart_tasks").insert(taskRows, { count: "exact" });
      if (error) console.error("smart_tasks insert", error);
      else insertedTasks = count || taskRows.length;
    }

    // Route the same suggested tasks through the central dispatcher so they
    // become real tasks distributed to employees with daily-capacity caps.
    let dispatched = 0;
    let overflow = 0;
    try {
      const dispatcherSuggestions = (report.suggested_tasks || []).slice(0, 30).map((t: any) => ({
        source: "daily_intelligence",
        title: String(t.title).slice(0, 200),
        description: t.description,
        donor_ref: t.donor_ref || null,
        channel: t.channel || null,
        priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
        suggested_message: t.suggested_message || null,
        due_in_days: Math.max(0, Number(t.due_in_days) || 0),
        category: t.category || "متابعة",
        dedupe_key: `daily_intelligence|${t.donor_ref || ""}|${String(t.title).slice(0, 60)}`,
        metadata: { trigger, dataset, source_report_date: snapshot.today },
      }));
      if (dispatcherSuggestions.length) {
        const dispResp = await fetch(`${SUPABASE_URL}/functions/v1/smart-task-dispatcher`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ organization_id: orgId, suggestions: dispatcherSuggestions }),
        });
        if (dispResp.ok) {
          const dj = await dispResp.json();
          dispatched = dj?.scheduled || 0;
          overflow = dj?.overflow || 0;
        } else {
          console.error("dispatcher invoke failed", dispResp.status, await dispResp.text());
        }
      }
    } catch (e) {
      console.error("dispatcher call error", e);
    }

    return json({
      ok: true,
      report,
      stats: {
        insights_saved: insertedInsights.length,
        tasks_saved: insertedTasks,
        tasks_dispatched: dispatched,
        tasks_overflow: overflow,
        snapshot_totals: snapshot.totals,
      },
    });
  } catch (e: any) {
    console.error("daily-donor-intelligence error", e);
    return json({ error: e?.message || "خطأ غير متوقع" }, 500);
  }
});