// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REPORT_LABELS: Record<string, string> = {
  donor_tiers: "تقرير المتبرعين حسب الفئة المالية",
  campaigns: "تقرير الحملات",
  failed_donations: "تقرير التبرعات الفاشلة",
  abandoned_carts: "تقرير السلال المتروكة",
  subscriptions: "تقرير المستقطعين",
  recurring_donors: "تقرير المتبرعين المتكررين",
  gifts: "تقرير الإهداءات",
  project_donors: "تقرير متبرعي المشاريع",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { report_type, filters, aggregates, samples } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const reportLabel = REPORT_LABELS[report_type] || report_type || "تقرير";

    const systemPrompt = `أنت خبير تنفيذي في إدارة تجربة المتبرع لجمعية خيرية سعودية.
مهمتك: تحويل بيانات التقرير إلى خطة عمل عملية للموظفين خلال هذا الأسبوع.
تكلّم بالعربية الفصحى المهنية. لا تكتفِ بالملاحظات؛ أعط أفعالاً واضحة.
اقترح 5-8 إجراءات ذكية، كل إجراء لشريحة محددة بقناة محددة (خطاب رسمي، اتصال هاتفي، واتساب، رسالة SMS، بريد إلكتروني، زيارة).
اكتب نص الرسالة جاهزاً للإرسال (موجز، شخصي، مؤثّر، يحترم خصوصية المتبرع).`;

    const userPrompt = `نوع التقرير: ${reportLabel}

الفلاتر المطبّقة: ${JSON.stringify(filters || {}, null, 2)}

المؤشرات الإجمالية: ${JSON.stringify(aggregates || {}, null, 2)}

عينات من الصفوف (مجهولة الهوية): ${JSON.stringify(samples || [], null, 2)}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "emit_report_actions",
          description: "Emit actionable follow-up items based on the report",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "ملخص استراتيجي قصير (3 جمل) عن حالة التقرير" },
              key_insights: {
                type: "array",
                items: { type: "string" },
                description: "3-5 رؤى رقمية مهمة"
              },
              actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "عنوان المهمة (لا يتجاوز 80 حرفًا)" },
                    target_segment: { type: "string", description: "وصف الشريحة المستهدفة" },
                    estimated_count: { type: "integer", description: "العدد التقريبي للأشخاص المستهدفين" },
                    channel: { type: "string", enum: ["letter", "call", "whatsapp", "sms", "email", "visit"] },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    due_in_days: { type: "integer", description: "عدد الأيام المقترحة للإنجاز (1-14)" },
                    suggested_message: { type: "string", description: "نص الرسالة الجاهز للإرسال" },
                    rationale: { type: "string", description: "لماذا هذه الفكرة الآن؟" }
                  },
                  required: ["title", "target_segment", "channel", "priority", "due_in_days", "suggested_message", "rationale"]
                }
              }
            },
            required: ["summary", "key_insights", "actions"]
          }
        }
      }
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_report_actions" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح. حاول مجددًا بعد قليل." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "نفدت أرصدة الذكاء الاصطناعي. يرجى إضافة رصيد." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      throw new Error("AI gateway error");
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = { summary: "", key_insights: [], actions: [] };
    if (call?.function?.arguments) {
      try { parsed = JSON.parse(call.function.arguments); } catch (e) { console.error("parse error", e); }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("report-suggestions error", e);
    return new Response(JSON.stringify({ error: e?.message || "خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});