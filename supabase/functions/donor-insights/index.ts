import { withRulesMode } from "../_shared/rule-mode.ts";
// Edge function: donor-insights
// Receives anonymized aggregated donor activity stats and returns AI-generated
// creative engagement ideas via Lovable AI Gateway with structured tool-calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت خبير عالمي في تنمية الموارد للجمعيات الخيرية وتجربة المتبرع وعلم سلوك العطاء.
ستستلم ملخّصاً مجمّعاً (بدون أي بيانات شخصية) عن "نخبة المتبرعين" في جمعية خيرية —
أشخاص لديهم أكثر من نشاط (تبرعات + استقطاعات + حملات + إهداءات + سلال متروكة).

مهمتك إنتاج أفكار غير مسبوقة، إبداعية، عملية، وقابلة للتنفيذ فوراً، باللغة العربية الفصحى الراقية،
بأسلوب جذّاب يعكس فهماً عميقاً للسياق السعودي والخليجي وثقافة العطاء.

تجنّب الكليشيهات. اقترح أفكاراً يندر أن تجدها الجمعيات الأخرى. اربط بين الأنشطة المختلفة بطرق ذكية.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "donor_engagement_plan",
    description: "خطة تفعيل وتنمية متكاملة لشريحة نخبة المتبرعين",
    parameters: {
      type: "object",
      properties: {
        executive_summary: {
          type: "string",
          description: "ملخّص تنفيذي من 3-5 جمل عن الفرص الكبرى الكامنة في هذه القاعدة",
        },
        segments: {
          type: "array",
          description: "تشخيص الشرائح السلوكية الموجودة وما يميّزها",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "اسم الشريحة" },
              description: { type: "string", description: "وصف وسلوك الشريحة وفرصتها" },
            },
            required: ["title", "description"],
          },
        },
        retention_ideas: {
          type: "array",
          description: "5-7 أفكار للحفاظ على هؤلاء المتبرعين وتعميق ولائهم",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string", description: "كيف تُنفّذ + الأثر المتوقع" },
            },
            required: ["title", "description"],
          },
        },
        creative_campaigns: {
          type: "array",
          description: "5-6 حملات/مبادرات إبداعية مبتكرة موجّهة لهؤلاء",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "description"],
          },
        },
        content_drafts: {
          type: "array",
          description: "مسودات محتوى جاهزة للنشر/الإرسال (رسالة شكر، عرض حصري، قصة أثر…)",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string", description: "نص المسودة كاملاً جاهز للنسخ" },
            },
            required: ["title", "description"],
          },
        },
        tier_actions: {
          type: "array",
          description: "إجراءات مخصّصة لكل تصنيف (ماسي/ذهبي/فضي/برونزي)",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "اسم التصنيف" },
              description: { type: "string", description: "إجراءات مفصّلة لهذا التصنيف" },
            },
            required: ["title", "description"],
          },
        },
      },
      required: ["executive_summary", "segments", "retention_ideas", "creative_campaigns", "content_drafts", "tier_actions"],
      additionalProperties: false,
    },
  },
};

Deno.serve(withRulesMode("donor-insights", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY غير مهيّأ");

    const payload = await req.json();

    let userMessage: string;
    if (payload?.panel) {
      userMessage = `سياق: قسم "${payload.panel_label || payload.panel}" داخل مركز التبرعات في جمعية خيرية.

هذه بيانات مجمّعة (مجهولة الهوية) خاصة بهذا القسم تحديداً:
${JSON.stringify(payload.context ?? {}, null, 2)}

مهمتك: أنتج رؤى وأفكاراً عملية مبتكرة موجّهة تحديداً لهذا القسم
(${payload.panel_label || payload.panel})، عبر استدعاء الأداة donor_engagement_plan.
اربط التحليل بطبيعة هذا القسم بالذات، لا بمتبرعي النخبة بشكل عام.
اجعل الأفكار رقمية، قابلة للقياس، ومبتكرة بصدق.`;
    } else {
      userMessage = `هذه بيانات مجمّعة (مجهولة الهوية) عن نخبة المتبرعين:

- إجمالي عدد النخبة (لديهم نشاطان أو أكثر): ${payload.elite_count}
- إجمالي عدد التبرعات في النظام: ${payload.total_donations_count}
- إجمالي مبلغ التبرعات: ${(payload.total_donations_amount || 0).toLocaleString("ar-SA")} ر.س
- توزّع التصنيفات: ${JSON.stringify(payload.tiers)}
- أكثر المشاريع جذباً للنخبة: ${JSON.stringify(payload.top_projects)}

تفصيل عيّنة من النخبة (أول ${payload.elite_breakdown?.length || 0} شخص):
${JSON.stringify(payload.elite_breakdown, null, 2)}

أنتج خطة تفعيل وتنمية كاملة عبر استدعاء الأداة donor_engagement_plan.
اجعل الأفكار عملية، رقمية، قابلة للقياس، ومبتكرة بصدق.`;
    }

    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KFAAH_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "donor_engagement_plan" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات. حاول بعد قليل." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "نفدت رصيدك في Lovable AI. أضف رصيداً من الإعدادات." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "فشل توليد الرؤى" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "استجابة غير متوقعة من النموذج" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("donor-insights error:", e);
    return new Response(JSON.stringify({ error: e?.message || "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
