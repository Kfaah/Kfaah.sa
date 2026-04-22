// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates a narrative executive report (text), suitable for boards and official entities.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const { metrics, period_label } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({ error: "metrics required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `أنت مستشار تنفيذي لجمعية خيرية. أعد تقريرًا منظمًا على شكل JSON فقط (بدون أي نص خارج JSON). كل بند يحتوي على "النتيجة/الواقع" و"التحليل والتوجيه". لا تخترع أرقامًا. اكتب باحترافية وإيجاز.`;
    const user = `بيانات الجمعية "${metrics.org_name}" خلال الفترة: ${period_label || "منذ البداية"}
- إجمالي الإيرادات: ${Math.round(metrics.total_donated).toLocaleString("ar")} ر.س
- عدد التبرعات: ${metrics.donations_count}
- متوسط التبرع: ${Math.round(metrics.avg_donation).toLocaleString("ar")} ر.س
- المتبرعون النشطون: ${metrics.donors} (المنتظمون: ${metrics.recurring_donors})
- إجمالي قاعدة المتبرعين: ${metrics.donors_total}
- السلال المتروكة: ${metrics.abandoned_carts} (مسترجع: ${metrics.recovered_carts}, نسبة: ${metrics.recovery_rate.toFixed(1)}%)
- التحويلات البنكية: ${metrics.bank_transfers} (مطابقة: ${metrics.matched_transfers})
- الموظفون: ${metrics.employees_count} | المهام: ${metrics.tasks_total} (مكتمل: ${metrics.tasks_completed}, نسبة: ${metrics.task_completion_rate.toFixed(1)}%)
- الحملات: ${metrics.campaigns}
- الدرجات (0-100): جمع التبرعات ${metrics.fundraising_score.toFixed(0)} / تفاعل ${metrics.donor_engagement_score.toFixed(0)} / خدمة ${metrics.service_score.toFixed(0)} / فريق ${metrics.team_score.toFixed(0)} / إجمالي ${metrics.overall_score.toFixed(0)}

أعد JSON بالشكل التالي حصرًا:
{
  "executive_summary": "فقرة موجزة (٣-٤ أسطر) تلخص الحالة العامة.",
  "overall_verdict": "ممتاز | جيد | متوسط | يحتاج تحسين | حرج",
  "sections": [
    {
      "title": "أداء جمع التبرعات",
      "rows": [
        { "metric": "اسم المؤشر بإيجاز", "result": "الرقم/الواقع كنص قصير", "analysis": "التحليل والتوجيه التنفيذي في جملتين كحد أقصى" }
      ]
    }
  ],
  "strategic_recommendations": ["توصية ١", "توصية ٢", "توصية ٣"]
}

يجب أن تشمل الأقسام: "أداء جمع التبرعات", "قاعدة المتبرعين", "كفاءة العمليات وخدمة المتبرع", "الأداء التشغيلي والفريق", "التقييم العام". كل قسم يحوي 3-5 صفوف على الأقل. لا نص خارج JSON.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
        seed: 11,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "نفذ الرصيد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error("AI gateway error");
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content || "{}";
    let parsed: any = null;
    try { parsed = JSON.parse(text); }
    catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch { /* ignore */ } }
    }
    if (!parsed || !parsed.sections) {
      return new Response(JSON.stringify({ error: "تعذّر تحليل استجابة الذكاء الاصطناعي", raw: text }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ report: parsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("executive-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});