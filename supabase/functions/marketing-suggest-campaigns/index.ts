import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchSiteText(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return "";
    const html = await resp.text();
    // Strip scripts/styles, then tags
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 6000);
  } catch (_e) {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organization_id, goal_key, extra_note, wizard_answers } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY not configured");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [donorsRes, donationsRes, projectsRes, tiersRes, prevRes, seasonsRes, orgRes, profRes, insightsRes] = await Promise.all([
      supa.from("donors").select("id, donor_tier, total_donated").eq("organization_id", organization_id).limit(500),
      supa.from("donations").select("amount, project_name, donation_date, status").eq("organization_id", organization_id).order("donation_date", { ascending: false }).limit(500),
      supa.from("projects").select("name, description, target_amount, raised_amount, status").eq("organization_id", organization_id).limit(50),
      supa.from("donor_tiers").select("tier_name, donor_count, avg_donation").eq("organization_id", organization_id).limit(20),
      supa.from("marketing_campaigns").select("name, status, expected_kpis, ai_metadata").eq("organization_id", organization_id).order("created_at", { ascending: false }).limit(10),
      supa.from("marketing_seasonal_events").select("key, name_ar, category, hijri_month, gregorian_month, marketing_tips").eq("is_active", true),
      supa.from("organizations").select("name, contact_email").eq("id", organization_id).maybeSingle(),
      supa.from("organization_profiles").select("about, website_url, store_url, twitter_url, instagram_url, tiktok_url, snapchat_url, youtube_url, ai_analysis").eq("organization_id", organization_id).maybeSingle(),
      supa.from("org_external_insights").select("category, title, description").eq("organization_id", organization_id).limit(30),
    ]);

    const donorsCount = donorsRes.data?.length ?? 0;
    const donationsCount = donationsRes.data?.length ?? 0;
    const projectsCount = projectsRes.data?.length ?? 0;
    const prevCount = prevRes.data?.length ?? 0;

    const isColdStart = donorsCount === 0 && donationsCount === 0 && prevCount === 0;

    // Cold-start enrichment: try fetching website snippet
    let websiteSnippet = "";
    let storeSnippet = "";
    if (isColdStart) {
      const websiteUrl = profRes.data?.website_url || wizard_answers?.website_url;
      const storeUrl = profRes.data?.store_url || wizard_answers?.store_url;
      if (websiteUrl) websiteSnippet = await fetchSiteText(websiteUrl);
      if (storeUrl) storeSnippet = await fetchSiteText(storeUrl);
    }

    const ctx = {
      org: orgRes.data,
      profile: profRes.data,
      donors_count: donorsCount,
      donor_tiers: tiersRes.data ?? [],
      recent_donations_sample: (donationsRes.data ?? []).slice(0, 50),
      projects: projectsRes.data ?? [],
      previous_campaigns: prevRes.data ?? [],
      seasonal_events: seasonsRes.data ?? [],
      external_insights: insightsRes.data ?? [],
      website_text_snippet: websiteSnippet || null,
      store_text_snippet: storeSnippet || null,
      employee_answers: wizard_answers ?? null,
      mode: isColdStart ? "cold_start" : "data_driven",
      now: new Date().toISOString(),
    };

    const goalMap: Record<string, string> = {
      donations: "زيادة التبرعات لمشروع/هدف محدد",
      awareness: "نشر الوعي ورفع تفاعل الجمهور",
      reactivate: "استرجاع المتبرعين المنقطعين (90+ يوم)",
      acquire: "جذب متبرعين جدد",
      seasonal: "استثمار موسم ديني/وطني قادم",
    };
    const focusLine = goal_key
      ? `\n\nتركيز الموظف على هدف: ${goalMap[goal_key] ?? goal_key}. اقترح 3 حملات فقط مرتبطة مباشرة بهذا الهدف.`
      : "";
    const noteLine = extra_note?.trim() ? `\n\nملاحظة من الموظف: ${extra_note.trim()}` : "";

    const coldStartGuidance = isColdStart
      ? `\n\n⚠️ وضع البداية الباردة (Cold Start):\n- لا توجد بيانات سابقة (متبرعين/تبرعات/حملات).\n- اعتمد كليًا على: محتوى الموقع/المتجر، إجابات الموظف، أفضل الممارسات للجمعيات السعودية.\n- اقترح حملات بسيطة منخفضة المخاطر للبداية: حملة تعريفية + حملة جذب أول 100 متبرع + حملة موسمية قريبة.\n- اقترح KPIs واقعية للبداية (مثلاً: 50 تبرع أول، 1000 وصول).\n- اقترح ميزانية محافظة (500-3000 ر.س للحملة الأولى).`
      : "";

    const systemPrompt = `أنت خبير تسويق احترافي للجمعيات الخيرية في السعودية. مهمتك اقتراح 3 حملات تسويقية ذكية بناءً على السياق المتاح.
كل حملة يجب أن:
- تستهدف شريحة محددة
- تستفيد من الموسم القادم إن وجد
- تربط بمشروع/أثر فعلي للجمعية (إن وُجد)
- تحدد المنصات المناسبة للجمهور
- تقترح رسالة رئيسية + 3 زوايا محتوى
- تقدر ميزانية معقولة بالريال السعودي
- تحدد KPIs قابلة للقياس
- تذكر في rationale ما هو المصدر الذي بنيت عليه الاقتراح (بيانات/موقع/إجابات الموظف)

أعد النتيجة فقط عبر استدعاء الدالة suggest_campaigns.`;

    const userPrompt = `سياق الجمعية:\n${JSON.stringify(ctx, null, 2)}${focusLine}${noteLine}${coldStartGuidance}\n\nاقترح حملات تسويقية احترافية الآن.`;

    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_campaigns",
            description: "Return marketing campaign suggestions",
            parameters: {
              type: "object",
              properties: {
                campaigns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      goal: { type: "string" },
                      audience_segment: { type: "string" },
                      season_key: { type: "string" },
                      related_project: { type: "string" },
                      primary_message: { type: "string" },
                      content_angles: { type: "array", items: { type: "string" } },
                      platforms: { type: "array", items: { type: "string" } },
                      budget_planned: { type: "number" },
                      duration_days: { type: "number" },
                      expected_kpis: {
                        type: "object",
                        properties: {
                          reach: { type: "number" },
                          conversions: { type: "number" },
                          donations_amount: { type: "number" },
                          roi: { type: "number" },
                        },
                      },
                      drafts: {
                        type: "object",
                        properties: {
                          whatsapp: { type: "string" },
                          sms: { type: "string" },
                          x_post: { type: "string" },
                          instagram_caption: { type: "string" },
                          video_script: { type: "string" },
                        },
                      },
                      design_brief: { type: "string" },
                      rationale: { type: "string" },
                    },
                    required: ["name", "goal", "audience_segment", "primary_message", "platforms", "rationale"],
                  },
                },
              },
              required: ["campaigns"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_campaigns" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام. حاول لاحقًا." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "الرصيد غير كاف." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { campaigns: [] };

    return new Response(JSON.stringify({
      campaigns: args.campaigns ?? [],
      mode: ctx.mode,
      sources_used: {
        website: !!websiteSnippet,
        store: !!storeSnippet,
        donor_data: donorsCount > 0,
        projects: projectsCount > 0,
        previous_campaigns: prevCount > 0,
        employee_answers: !!wizard_answers,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("marketing-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
