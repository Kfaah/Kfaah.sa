import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authorizationErrorResponse, requireOrganizationAccess } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, brief_type } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY not configured");
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await supa.from("marketing_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!c) return new Response(JSON.stringify({ error: "campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    await requireOrganizationAccess(req, c.organization_id, supa);

    const type = brief_type ?? "design"; // design | video | motion
    const systemPrompt = `أنت Creative Director محترف للجمعيات الخيرية. اكتب بريف ${type} كامل ودقيق للمصمم/المخرج بالعربية. أعد النتيجة عبر الدالة generate_brief.`;
    const userPrompt = `الحملة: ${JSON.stringify({
      name: c.name, goal: c.goal, audience: c.audience_segment,
      primary_message: c.primary_message, project: c.related_project, season: c.season_key,
    }, null, 2)}\nنوع البريف: ${type}`;

    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "generate_brief",
            description: "Return creative brief",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                concept: { type: "string" },
                visual_direction: { type: "string" },
                color_palette: { type: "array", items: { type: "string" } },
                typography: { type: "string" },
                key_visuals: { type: "array", items: { type: "string" } },
                copy_on_design: { type: "string" },
                deliverables: { type: "array", items: { type: "string" } },
                dont_do: { type: "array", items: { type: "string" } },
                references_keywords: { type: "array", items: { type: "string" } },
                duration_seconds: { type: "number" },
                scenes: { type: "array", items: { type: "object", properties: { time: { type: "string" }, action: { type: "string" }, voiceover: { type: "string" } } } },
              },
              required: ["title", "concept", "deliverables"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_brief" } },
      }),
    });
    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "الرصيد غير كاف." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) { const t = await aiResp.text(); console.error(t); return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const aiData = await aiResp.json();
    const args = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    return new Response(JSON.stringify({ brief: args }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});