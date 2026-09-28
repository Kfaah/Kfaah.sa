import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authorizationErrorResponse, requireOrganizationAccess } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, save_to_playbook } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY not configured");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await supa
      .from("marketing_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (!c) return new Response(JSON.stringify({ error: "campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await requireOrganizationAccess(req, c.organization_id, supa);

    const [mRes, chRes, prevRes] = await Promise.all([
      supa.from("marketing_campaign_metrics").select("*").eq("campaign_id", campaign_id),
      supa.from("marketing_campaign_channels").select("channel, status").eq("campaign_id", campaign_id),
      supa
        .from("marketing_playbook_memory")
        .select("insight_type, finding, channel, audience_segment")
        .eq("organization_id", c.organization_id)
        .limit(20),
    ]);

    const metrics = mRes.data ?? [];
    const totals = metrics.reduce((acc: any, m: any) => ({
      impressions: acc.impressions + (m.impressions || 0),
      clicks: acc.clicks + (m.clicks || 0),
      conversions: acc.conversions + (m.conversions || 0),
      donations_count: acc.donations_count + (m.donations_count || 0),
      donations_amount: acc.donations_amount + Number(m.donations_amount || 0),
      cost: acc.cost + Number(m.cost || 0),
    }), { impressions: 0, clicks: 0, conversions: 0, donations_count: 0, donations_amount: 0, cost: 0 });

    const ctx = {
      campaign: { name: c.name, goal: c.goal, audience_segment: c.audience_segment, primary_message: c.primary_message, season: c.season_key, platforms: c.platforms, expected_kpis: c.expected_kpis, budget_planned: c.budget_planned, status: c.status },
      actuals: totals,
      per_channel: metrics,
      channels_status: chRes.data ?? [],
      organization_playbook: prevRes.data ?? [],
    };

    const systemPrompt = `أنت محلل تسويقي خبير في الجمعيات الخيرية السعودية. حلّل أداء الحملة وقدّم تقييمًا مهنيًا، نقاط قوة، نقاط ضعف، وتوصيات تنفيذية واضحة. استخرج دروسًا قابلة لإعادة الاستخدام (Playbook). أعد النتيجة فقط عبر الدالة evaluate_campaign.`;
    const userPrompt = `بيانات الحملة والأداء:\n${JSON.stringify(ctx, null, 2)}`;

    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "evaluate_campaign",
            description: "Return campaign evaluation",
            parameters: {
              type: "object",
              properties: {
                overall_grade: { type: "string", enum: ["ممتاز", "جيد جدًا", "جيد", "متوسط", "ضعيف"] },
                summary: { type: "string", description: "ملخص تنفيذي 3-5 أسطر" },
                kpi_analysis: {
                  type: "object",
                  properties: {
                    reach_vs_expected: { type: "string" },
                    conversion_rate: { type: "string" },
                    roi_pct: { type: "number" },
                    cost_per_donation: { type: "number" },
                  },
                },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                recommendations: {
                  type: "array",
                  description: "توصيات تنفيذية مرتبة حسب الأولوية",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string" },
                      why: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["action"],
                  },
                },
                best_channel: { type: "string" },
                worst_channel: { type: "string" },
                playbook_insights: {
                  type: "array",
                  description: "دروس قابلة لإعادة الاستخدام في حملات قادمة",
                  items: {
                    type: "object",
                    properties: {
                      insight_type: { type: "string", enum: ["success", "failure", "best_time", "best_channel", "message_pattern"] },
                      finding: { type: "string" },
                      channel: { type: "string" },
                      audience_segment: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["insight_type", "finding"],
                  },
                },
              },
              required: ["overall_grade", "summary", "recommendations"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "evaluate_campaign" } },
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "الرصيد غير كاف." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) { const t = await aiResp.text(); console.error(t); return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const aiData = await aiResp.json();
    const evalResult = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");

    // Persist evaluation on campaign + optionally write to playbook
    await supa.from("marketing_campaigns").update({
      ai_metadata: { ...(c.ai_metadata || {}), last_evaluation: evalResult, evaluated_at: new Date().toISOString() },
    }).eq("id", campaign_id);

    if (save_to_playbook && Array.isArray(evalResult.playbook_insights) && evalResult.playbook_insights.length > 0) {
      const rows = evalResult.playbook_insights.map((p: any) => ({
        organization_id: c.organization_id,
        campaign_id,
        insight_type: p.insight_type,
        finding: p.finding,
        channel: p.channel ?? null,
        audience_segment: p.audience_segment ?? c.audience_segment ?? null,
        confidence: typeof p.confidence === "number" ? p.confidence : 0.6,
        evidence: { totals, campaign: c.name },
      }));
      await supa.from("marketing_playbook_memory").insert(rows);
    }

    return new Response(JSON.stringify({ evaluation: evalResult, totals }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});