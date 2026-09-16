// التحليل الشامل الذكي للمتجر
// يجمع: مقاييس المتجر + شرائح المتبرعين + محتوى الموقع والمتجر وحسابات التواصل
// ويخرج: ملخص تنفيذي + مراجعة المنصات + خطة تنفيذية لرسائل المتبرعين + مقترحات

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const AI_MODEL = "openai/gpt-6-astra";

async function scrape(url?: string | null, limit = 4000): Promise<string | null> {
  if (!FIRECRAWL_API_KEY || !url) return null;
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const md = j?.markdown || j?.data?.markdown || j?.data?.content || "";
    return typeof md === "string" && md.trim() ? md.slice(0, limit) : null;
  } catch {
    return null;
  }
}

const RESULT_SHAPE = `{
  "executive_summary": "ملخص تنفيذي مركّز (5-7 أسطر) يربط الأرقام بالقرارات",
  "headline_findings": ["نتيجة رقمية لافتة 1", "..."],
  "donor_analysis": {
    "overview": "تحليل سلوك المتبرعين عموماً",
    "segments": [
      { "name": "اسم الشريحة", "criteria": "معيار الانضمام للشريحة", "size_estimate": "تقدير الحجم", "value": "قيمتها المالية", "behavior": "سلوكها", "risk": "المخاطر", "action": "الإجراء المطلوب" }
    ],
    "retention": "قراءة الولاء والتكرار والاستقطاع الشهري",
    "churn_signals": ["مؤشر تسرب 1", "..."]
  },
  "web_review": {
    "website": { "strengths": [], "gaps": [], "fix_list": [] },
    "store": { "strengths": [], "gaps": [], "fix_list": [] },
    "social": { "strengths": [], "gaps": [], "fix_list": [] }
  },
  "messaging_plan": {
    "objective": "هدف خطة الرسائل",
    "waves": [
      { "wave": "اسم الموجة", "segment": "الشريحة المستهدفة", "channel": "واتساب | رسالة نصية | بريد | اتصال", "timing": "التوقيت", "goal": "الهدف الرقمي", "message_ar": "نص الرسالة جاهز للإرسال بصيغة مهنية مع متغيرات مثل {الاسم} و{المشروع}", "kpi": "مؤشر القياس", "owner": "الجهة المسؤولة" }
    ],
    "calendar": [ { "week": "الأسبوع 1", "tasks": ["مهمة 1", "..."] } ]
  },
  "recommendations": [
    { "title": "عنوان المقترح", "why": "المبرر من الأرقام", "how": ["خطوة 1", "خطوة 2"], "impact": "الأثر المتوقع", "effort": "منخفض | متوسط | مرتفع", "priority": "critical | high | medium | low" }
  ],
  "kpi_targets": [ { "kpi": "المؤشر", "current": "القيمة الحالية", "target_90d": "المستهدف بعد 90 يوماً" } ],
  "risks": ["مخاطرة 1", "..."]
}`;

async function callAstra(system: string, payload: unknown) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "حلّل البيانات التالية وأعد النتيجة كـ JSON فقط بلا أي نص إضافي وبلا علامات كود:\n" +
                JSON.stringify(payload),
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const t = await res.text();
    throw new Error(`ai_${res.status}: ${t.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const ev = JSON.parse(raw);
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
        else if (ev.type === "response.completed" && ev.response?.output_text) {
          const ot = Array.isArray(ev.response.output_text)
            ? ev.response.output_text.join("")
            : String(ev.response.output_text);
          if (!text) text = ot;
        }
      } catch { /* ignore partial */ }
    }
  }

  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(jsonText);
  } catch {
    return { executive_summary: cleaned.slice(0, 4000), parse_error: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { organization_id, metrics, from, to } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [orgRes, profRes] = await Promise.all([
      admin.from("organizations").select("id,name").eq("id", organization_id).maybeSingle(),
      admin.from("organization_profiles").select("*").eq("organization_id", organization_id).maybeSingle(),
    ]);
    const org = orgRes.data as any;
    const profile = profRes.data as any;

    const [website, store, twitter, instagram] = await Promise.all([
      scrape(profile?.website_url),
      scrape(profile?.store_url),
      scrape(profile?.twitter_url, 1500),
      scrape(profile?.instagram_url, 1500),
    ]);

    const system = `أنت مستشار تسويق واستدامة مالية للجمعيات الخيرية السعودية، خبير في تحليل متاجر التبرع الإلكترونية وسلوك المتبرعين.
اكتب بالعربية الفصحى الاحترافية، واعتمد على الأرقام المعطاة حرفياً (لا تختلق أرقاماً).
كن شاملاً وعملياً: اذكر 5-8 شرائح للمتبرعين، و6-10 موجات رسائل جاهزة للإرسال، و8-12 مقترحاً تنفيذياً، وخطة أسبوعية لأربعة أسابيع على الأقل.
احرص أن تكون كل رسالة قصيرة (أقل من 400 حرف) ومهنية ومناسبة للسياق الخيري السعودي.
أعد النتيجة كـ JSON صالح بهذا الشكل بالضبط:
${RESULT_SHAPE}`;

    const payload = {
      organization: { name: org?.name },
      period: { from: from || null, to: to || null },
      store_metrics: metrics || null,
      profile: profile
        ? {
            about: profile.about,
            goals: profile.goals,
            website_url: profile.website_url,
            store_url: profile.store_url,
            social: {
              twitter: profile.twitter_url,
              instagram: profile.instagram_url,
              tiktok: profile.tiktok_url,
              snapchat: profile.snapchat_url,
              youtube: profile.youtube_url,
              facebook: profile.facebook_url,
              linkedin: profile.linkedin_url,
            },
          }
        : null,
      scraped: { website, store, twitter, instagram },
    };

    const result = await callAstra(system, payload);

    return new Response(
      JSON.stringify({
        success: true,
        sources_read: {
          website: !!website,
          store: !!store,
          twitter: !!twitter,
          instagram: !!instagram,
        },
        analysis: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
