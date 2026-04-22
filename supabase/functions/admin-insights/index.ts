// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const { metrics, all, period_label, period_from, period_to, force } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({ error: "metrics required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try cache first (stable analysis for same org+period)
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, supaKey);

    if (!force) {
      const { data: cached } = await admin
        .from("admin_ai_insights_cache")
        .select("id, insight, generated_at")
        .eq("organization_id", metrics.org_id)
        .eq("period_label", period_label || "منذ البداية")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.insight) {
        return new Response(JSON.stringify({ insight: cached.insight, cache_id: cached.id, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build a compact context comparing this org against the others
    const peers = (all || []).filter((m: any) => m.org_id !== metrics.org_id);
    const avgRev = peers.length ? peers.reduce((s: number, m: any) => s + m.total_donated, 0) / peers.length : 0;
    const avgScore = peers.length ? peers.reduce((s: number, m: any) => s + m.overall_score, 0) / peers.length : 0;

    const systemPrompt = `أنت محلل بيانات تنفيذي خبير في إدارة الجمعيات الخيرية والتبرعات وخدمة المتبرعين. مهمتك إنتاج تحليل عربي احترافي شامل وثابت لنفس المدخلات.
قواعد إلزامية:
- اعتمد فقط على الأرقام المرسلة ولا تخترع أي رقم أو معلومة.
- إذا كانت البيانات غير كافية في نقطة ما، اذكر ذلك كاستنتاج محدود لا كحقيقة.
- لنفس البيانات والفترة يجب أن تكون النتيجة بنفس المنطق والترتيب قدر الإمكان؛ لا تضف تنويعات إبداعية عشوائية.
- لا تحذف أي ملاحظة مهمة: غطِّ الإيرادات، عدد التبرعات، متوسط التبرع، المتبرعين، المتبرعين المنتظمين، السلال المتروكة، التحويلات البنكية، الموظفين، المهام، الحملات، والدرجات المركبة.
- استخرج كل نقطة قوة/ضعف/فرصة من مقارنة مباشرة بين أداء الجمعية ومتوسط الجمعيات الأخرى أو من المؤشرات الداخلية.
- التوصيات يجب أن تكون عملية، قابلة للتنفيذ، مرتبة بالأولوية، ومربوطة بسبب واضح من البيانات.
- اكتب بلغة تنفيذية ذكية ومباشرة، بدون حشو.`;

    const userPrompt = `حلّل أداء هذه الجمعية للفترة: ${period_label || "منذ البداية"}
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

قدّم تحليلاً شاملاً يتضمن:
1) ملخّص تنفيذي يغطي أهم الاستنتاجات ولا يتجاوز 4 جمل.
2) 4-6 نقاط قوة، مع عدم تجاهل أي مؤشر إيجابي واضح.
3) 4-6 نقاط ضعف أو مخاطر تشغيلية/تسويقية، مع عدم تجاهل أي مؤشر سلبي واضح.
4) 3-5 فرص نمو وتحسين مستندة إلى البيانات.
5) 6-8 توصيات قابلة للتنفيذ مع مستوى التأثير، مرتبة من الأعلى أثرًا إلى الأقل.
راجع إجابتك داخليًا قبل الإرسال للتأكد من الشمول والدقة والثبات وعدم وجود نقص أو أخطاء.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0,
        top_p: 0.1,
        seed: 42,
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

    // Persist to cache for stable reproducibility + plan generation
    const { data: saved } = await admin
      .from("admin_ai_insights_cache")
      .insert({
        organization_id: metrics.org_id,
        period_label: period_label || "منذ البداية",
        period_from: period_from || null,
        period_to: period_to || null,
        insight,
        metrics_snapshot: metrics,
      })
      .select("id")
      .maybeSingle();

    return new Response(JSON.stringify({ insight, cache_id: saved?.id, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-insights error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
