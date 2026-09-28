import { authorizationErrorResponse, requireTrustedCaller } from "../_shared/authz.ts";
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates innovation suggestions: creative, actionable improvements
 * personalized to the org's data. Returns structured JSON.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireTrustedCaller(req);
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY not configured");
    const { metrics, period_label, focus } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({ error: "metrics required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `أنت خبير ابتكار ومنتج متخصص في منصات الجمعيات الخيرية الرقمية. مهمتك تحويل البيانات إلى أفكار قابلة للتنفيذ. كل فكرة يجب أن تستند إلى رقم محدد من البيانات. لا تخترع أرقامًا. لا تكرر الأفكار التقليدية مثل "زد الحملات". اطرح أفكارًا غير مسبوقة، إبداعية، ذكية، وعملية. اكتب JSON فقط بدون أي نص خارجه.`;

    const user = `بيانات الجمعية "${metrics.org_name}" خلال الفترة: ${period_label || "منذ البداية"}
- إجمالي الإيرادات: ${Math.round(metrics.total_donated).toLocaleString("ar")} ر.س | عدد التبرعات: ${metrics.donations_count} | متوسط التبرع: ${Math.round(metrics.avg_donation).toLocaleString("ar")} ر.س
- المتبرعون: ${metrics.donors} نشط (إجمالي: ${metrics.donors_total}, منتظم: ${metrics.recurring_donors})
- السلال المتروكة: ${metrics.abandoned_carts} (مسترجع: ${metrics.recovered_carts}, نسبة: ${(metrics.recovery_rate||0).toFixed(1)}%)
- التحويلات البنكية: ${metrics.bank_transfers} (مطابق: ${metrics.matched_transfers}, نسبة: ${(metrics.match_rate||0).toFixed(1)}%)
- التبرعات الفاشلة: ${metrics.failed_donations} (نسبة الفشل: ${(metrics.failure_rate||0).toFixed(1)}%)
- الإهداءات: ${metrics.gifts_count || 0} بقيمة ${Math.round(metrics.gifts_amount||0).toLocaleString("ar")} ر.س (تسليم: ${(metrics.gifts_delivery_rate||0).toFixed(1)}%)
- المشاريع: ${metrics.projects_count || 0} مشروع، أعلى مشروع: ${metrics.top_project_name || "—"} (${(metrics.top_project_share||0).toFixed(1)}% من الإيراد)
- الموظفون: ${metrics.employees_count} | المهام: ${metrics.tasks_total} (إنجاز: ${(metrics.task_completion_rate||0).toFixed(1)}%)
- الحملات: ${metrics.campaigns} | الأفكار: ${metrics.marketing_ideas} | الرؤى: ${metrics.insights}
- الدرجات: جمع التبرعات ${metrics.fundraising_score?.toFixed(0)} | تفاعل ${metrics.donor_engagement_score?.toFixed(0)} | خدمة ${metrics.service_score?.toFixed(0)} | فريق ${metrics.team_score?.toFixed(0)} | صحة المتجر ${metrics.store_health_score?.toFixed(0) || "—"}

${focus ? `تركيز خاص هذه المرة على: ${focus}` : ""}

اقترح 6 إلى 9 أفكار ابتكارية متنوعة تغطي المجالات التالية (لا تكرر الفئة كثيرًا):
- محتوى/مقالات الجمعية (content)
- تحليل عميق جديد لم يُفكَّر به (analytics)
- ميزة جديدة في المنصة (feature)
- تحسين تجربة (ux)
- أتمتة وعمليات داخلية (automation)
- شراكات وتسويق ذكي (growth)
- صحة بيانات وحوكمة (data)

أعد JSON بهذا الشكل حصرًا:
{
  "suggestions": [
    {
      "title": "عنوان قصير لافت (٤-٧ كلمات)",
      "summary": "وصف الفكرة بفقرة واحدة (٣-٤ أسطر) تشرح ما هي وكيف تنفذ ولماذا الآن.",
      "category": "content | analytics | feature | ux | automation | growth | data",
      "area": "أين تُطبَّق في المنصة (مثلاً: صفحة المتبرعين، التحليل العميق، صفحة المتجر، ...)",
      "priority": "high | medium | low",
      "impact": "وصف موجز للأثر المتوقع",
      "effort": "low | medium | high",
      "data_basis": "اذكر الأرقام المحددة من البيانات أعلاه التي تبرر الفكرة"
    }
  ]
}`;

    const r = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { "Authorization": `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.7,
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
      const m2 = text.match(/\{[\s\S]*\}/);
      if (m2) { try { parsed = JSON.parse(m2[0]); } catch {} }
    }
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return new Response(JSON.stringify({ error: "تعذّر تحليل الاستجابة", raw: text }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ suggestions: parsed.suggestions, model: "google/gemini-3-flash-preview" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    console.error("innovation-suggestions error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});