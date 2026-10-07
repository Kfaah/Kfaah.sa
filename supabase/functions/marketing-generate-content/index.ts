import { withRulesMode } from "../_shared/rule-mode.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(withRulesMode("marketing-generate-content", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, channel, tone, extra_instructions } = await req.json();
    if (!campaign_id || !channel) {
      return new Response(JSON.stringify({ error: "campaign_id and channel required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY not configured");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await supa.from("marketing_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!c) {
      return new Response(JSON.stringify({ error: "campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const channelGuide: Record<string, string> = {
      whatsapp: "رسالة واتساب: قصيرة (سطرين-3)، شخصية، إيموجي مناسب، CTA واضح برابط تبرع.",
      sms: "رسالة SMS: حد أقصى 160 حرف، مباشرة، CTA + رابط مختصر.",
      email: "إيميل: عنوان جذاب + فقرتان + CTA + توقيع.",
      x: "تغريدة X: 280 حرف، هاشتاق ذكي، تأثير عاطفي.",
      instagram: "كابشن إنستغرام: 4-6 أسطر + هاشتاقات + CTA.",
      snapchat: "نص قصير لسناب: 1-2 سطر + ستيكر اقتراح.",
      tiktok: "سكربت تيك توك 30 ثانية: hook قوي + قصة + CTA.",
      youtube: "سكربت يوتيوب 60-90 ثانية: مقدمة + قصة أثر + دعوة + خاتمة.",
      meta_ads: "نص إعلان Meta: عنوان + وصف + CTA. يلتزم بسياسات Meta للجمعيات.",
      google_ads: "نص إعلان Google Ads: 3 عناوين × 30 حرف + 2 وصف × 90 حرف.",
    };

    const systemPrompt = `أنت كاتب محتوى تسويقي محترف للجمعيات الخيرية في السعودية. اللهجة فصحى راقية. التزم بدليل القناة. أعد النتيجة عبر استدعاء الدالة generate_content.`;
    const userPrompt = `بيانات الحملة:\n${JSON.stringify({
      name: c.name, goal: c.goal, audience: c.audience_segment,
      primary_message: c.primary_message, content_angles: c.content_angles,
      related_project: c.related_project, season: c.season_key,
    }, null, 2)}\n\nالقناة المطلوبة: ${channel}\nالدليل: ${channelGuide[channel] ?? "محتوى قصير ومؤثر"}\nالنبرة: ${tone ?? "ملهمة ومحترفة"}\nملاحظات إضافية: ${extra_instructions ?? "—"}`;

    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "generate_content",
            description: "Return marketing content variants for a channel",
            parameters: {
              type: "object",
              properties: {
                variants: {
                  type: "array",
                  description: "3 variants: bold, soft, story-driven",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      body: { type: "string" },
                      hashtags: { type: "array", items: { type: "string" } },
                      cta: { type: "string" },
                    },
                    required: ["label", "body"],
                  },
                },
              },
              required: ["variants"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_content" } },
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "الرصيد غير كاف." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text(); console.error("AI error", t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiResp.json();
    const args = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? '{"variants":[]}');
    return new Response(JSON.stringify({ variants: args.variants ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}));
