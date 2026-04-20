// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { metrics, all } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({ error: "metrics required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a compact context comparing this org against the others
    const peers = (all || []).filter((m: any) => m.org_id !== metrics.org_id);
    const avgRev = peers.length ? peers.reduce((s: number, m: any) => s + m.total_donated, 0) / peers.length : 0;
    const avgScore = peers.length ? peers.reduce((s: number, m: any) => s + m.overall_score, 0) / peers.length : 0;

    const systemPrompt = `أنت محلل بيانات خبير في إدارة الجمعيات الخيرية والتبرعات. مهمتك تحليل أداء جمعية محددة ومقارنتها بمتوسط الجمعيات الأخرى وتقديم توصيات عملية واضحة باللغة العربية. كن دقيقًا، تحليليًا، وعمليًا. لا تخترع أرقامًا.`;

    const userPrompt = `حلّل أداء هذه الجمعية:
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

قدّم تحليلاً يتضمن: ملخّص تنفيذي، 3-4 نقاط قوة، 3-4 نقاط ضعف، 2-3 فرص، و4-6 توصيات قابلة للتنفيذ مع مستوى التأثير.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام، حاول لاحقًا" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "نفذ الرصيد، أضف مزيدًا من الاعتمادات" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const insight = args ? JSON.parse(args) : null;
    if (!insight) throw new Error("No insight returned");

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-insights error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
