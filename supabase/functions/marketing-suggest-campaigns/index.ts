import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull a compact context snapshot
    const [donorsRes, donationsRes, projectsRes, tiersRes, prevRes, seasonsRes, profileRes] = await Promise.all([
      supa.from("donors").select("id, donor_tier, total_donated").eq("organization_id", organization_id).limit(500),
      supa.from("donations").select("amount, project_name, donation_date, status").eq("organization_id", organization_id).order("donation_date", { ascending: false }).limit(500),
      supa.from("projects").select("name, description, target_amount, raised_amount, status").eq("organization_id", organization_id).limit(50),
      supa.from("donor_tiers").select("tier_name, donor_count, avg_donation").eq("organization_id", organization_id).limit(20),
      supa.from("marketing_campaigns").select("name, status, expected_kpis, ai_metadata").eq("organization_id", organization_id).order("created_at", { ascending: false }).limit(10),
      supa.from("marketing_seasonal_events").select("key, name_ar, category, hijri_month, gregorian_month, marketing_tips").eq("is_active", true),
      supa.from("organizations").select("name, mission, vision, focus_areas").eq("id", organization_id).maybeSingle(),
    ]);

    const ctx = {
      org: profileRes.data,
      donors_count: donorsRes.data?.length ?? 0,
      donor_tiers: tiersRes.data ?? [],
      recent_donations_sample: (donationsRes.data ?? []).slice(0, 50),
      projects: projectsRes.data ?? [],
      previous_campaigns: prevRes.data ?? [],
      seasonal_events: seasonsRes.data ?? [],
      now: new Date().toISOString(),
    };

    const systemPrompt = `أنت خبير تسويق احترافي للجمعيات الخيرية في السعودية. مهمتك اقتراح 3-5 حملات تسويقية ذكية مرتبة حسب الأولوية بناء على بيانات الجمعية الفعلية. كل حملة يجب أن:
- تستهدف شريحة محددة (كبار/متكررون/منقطعون/جدد)
- تستفيد من الموسم القادم إن وجد
- تربط بمشروع/أثر فعلي للجمعية
- تحدد المنصات المناسبة للجمهور (واتساب/SMS/X/إنستغرام/سناب/تيك توك/إيميل)
- تقترح رسالة رئيسية + 3 زوايا محتوى
- تقدر ميزانية معقولة بالريال السعودي
- تحدد KPIs قابلة للقياس

أعد النتيجة فقط عبر استدعاء الدالة suggest_campaigns.`;

    const userPrompt = `بيانات الجمعية:\n${JSON.stringify(ctx, null, 2)}\n\nاقترح حملات تسويقية احترافية الآن.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
                    required: ["name", "goal", "audience_segment", "primary_message", "platforms"],
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
      return new Response(JSON.stringify({ error: "الرصيد غير كاف. أضف رصيدًا في Settings > Workspace > Usage." }), {
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

    return new Response(JSON.stringify({ campaigns: args.campaigns ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("marketing-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});