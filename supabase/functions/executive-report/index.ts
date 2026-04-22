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

    const sys = `أنت مستشار تنفيذي يكتب تقريرًا رسميًا لمجلس إدارة جمعية خيرية. أسلوبك سرديّ احترافي راقٍ، خالٍ من الانفعال أو المبالغة، يستند فقط للأرقام المعطاة. لا تخترع أي معلومة. اكتب بصيغة الغائب.`;
    const user = `بيانات الجمعية "${metrics.org_name}" خلال الفترة: ${period_label || "منذ البداية"}
- إجمالي الإيرادات: ${Math.round(metrics.total_donated).toLocaleString("ar")} ر.س
- عدد التبرعات: ${metrics.donations_count}
- متوسط التبرع: ${Math.round(metrics.avg_donation).toLocaleString("ar")} ر.س
- المتبرعون: ${metrics.donors} منهم ${metrics.recurring_donors} منتظم
- السلال المتروكة: ${metrics.abandoned_carts} (مسترجع: ${metrics.recovered_carts}, نسبة: ${metrics.recovery_rate.toFixed(1)}%)
- التحويلات البنكية: ${metrics.bank_transfers} (مطابقة: ${metrics.matched_transfers})
- الموظفون: ${metrics.employees_count}, المهام: ${metrics.tasks_total} (مكتمل: ${metrics.tasks_completed}, نسبة: ${metrics.task_completion_rate.toFixed(1)}%)
- الحملات: ${metrics.campaigns}
- الدرجات (0-100): جمع التبرعات ${metrics.fundraising_score.toFixed(0)} / تفاعل ${metrics.donor_engagement_score.toFixed(0)} / خدمة ${metrics.service_score.toFixed(0)} / فريق ${metrics.team_score.toFixed(0)} / إجمالي ${metrics.overall_score.toFixed(0)}

اكتب تقريرًا رسميًا منظَّمًا في الأقسام التالية بصياغة سردية متماسكة:
1. مقدمة تنفيذية (فقرة واحدة)
2. أداء جمع التبرعات والإيرادات
3. قاعدة المتبرعين وسلوكهم
4. كفاءة العمليات وخدمة المتبرع
5. الأداء التشغيلي وفريق العمل
6. التقييم الختامي والتوجهات المقترحة (فقرة)

اجعل العناوين على شكل **عنوان** بين علامتي نجمتين، والفقرات قصيرة وواضحة.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
        seed: 11,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "نفذ الرصيد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error("AI gateway error");
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ report: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("executive-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});