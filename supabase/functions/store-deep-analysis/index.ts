// التحليل الشامل الذكي للمتجر
// يجمع: مقاييس المتجر + شرائح المتبرعين + محتوى الموقع والمتجر وحسابات التواصل
// ويخرج: ملخص تنفيذي + مراجعة المنصات + خطة تنفيذية لرسائل المتبرعين + مقترحات

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const AI_MODEL = "openai/gpt-6-astra";

const RequestSchema = z.object({
  organization_id: z.string().uuid(),
  metrics: z.record(z.unknown()).nullable().optional(),
  from: z.string().max(32).nullable().optional(),
  to: z.string().max(32).nullable().optional(),
});

type DigitalSource = { kind: string; label: string; url: string; cachedContent?: string | null };

const SOURCE_LABELS: Record<string, string> = {
  website: "الموقع الإلكتروني",
  store: "المتجر الإلكتروني",
  twitter: "حساب إكس",
  instagram: "حساب إنستغرام",
  tiktok: "حساب تيك توك",
  snapchat: "حساب سناب شات",
  youtube: "قناة يوتيوب",
  facebook: "صفحة فيسبوك",
  linkedin: "صفحة لينكدإن",
};

function validHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function scrape(source: DigitalSource, limit = 2200) {
  const fallback = source.cachedContent?.trim() || null;
  if (!FIRECRAWL_API_KEY) return { kind: source.kind, status: fallback ? "تم التحليل" : "تعذر الوصول", content: fallback };
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!r.ok) return { kind: source.kind, status: fallback ? "تم التحليل" : "تعذر الوصول", content: fallback };
    const j = await r.json();
    const md = j?.markdown || j?.data?.markdown || j?.data?.content || "";
    const content = typeof md === "string" && md.trim() ? md.slice(0, limit) : fallback;
    return { kind: source.kind, status: content ? "تم التحليل" : "محتوى غير كافٍ", content };
  } catch {
    return { kind: source.kind, status: fallback ? "تم التحليل" : "تعذر الوصول", content: fallback };
  }
}

const RESULT_SHAPE = `{
  "executive_summary": "ملخص تنفيذي موحّد ومركّز (3-4 أسطر) يربط بيانات المتجر بالحضور الرقمي والقرارات",
  "headline_findings": ["نتيجة رقمية لافتة 1", "..."],
  "donor_analysis": {
    "overview": "تحليل سلوك المتبرعين عموماً",
    "segments": [
      { "name": "اسم الشريحة", "criteria": "معيار الانضمام للشريحة", "size_estimate": "تقدير الحجم", "value": "قيمتها المالية", "behavior": "سلوكها", "risk": "المخاطر", "action": "الإجراء المطلوب" }
    ],
    "retention": "قراءة الولاء والتكرار والاستقطاع الشهري",
    "churn_signals": ["مؤشر تسرب 1", "..."]
  },
  "digital_presence": {
    "overview": "خلاصة موحدة قصيرة لما تعنيه المواقع والمتجر والحسابات لأداء التبرع",
    "strengths": ["أهم نقطتي قوة فقط"],
    "gaps": ["أهم فجوتين فقط"],
    "actions": ["أهم ثلاثة إجراءات مرتبة بالأولوية"]
  },
  "send_timing": {
    "summary": "قراءة أوقات الذروة من بيانات التبرع الفعلية بتوقيت الرياض",
    "best_hours": [ { "window": "20:00 – 21:00", "why": "المبرر من الأرقام", "channels": "واتساب | رسالة نصية" } ],
    "best_days": [ { "day": "الخميس", "why": "المبرر", "note": "ملاحظة تنفيذية" } ],
    "avoid": ["أوقات وأيام يُفضّل تجنبها ولماذا"],
    "frequency": "عدد الرسائل المسموح لكل متبرع شهرياً لكل قناة، بصياغة عربية كاملة",
    "cadence_by_segment": [ { "segment": "الشريحة", "channel": "القناة", "best_day": "اليوم", "best_time": "الساعة", "frequency": "التكرار" } ],
    "seasonal_windows": ["نوافذ موسمية (رمضان، العشر الأواخر، الحج، بداية العام الدراسي، الشتاء) مع التوقيت المقترح"]
  },
  "messaging_plan": {
    "objective": "هدف خطة الرسائل",
    "waves": [
      { "wave": "اسم الموجة", "segment": "الشريحة المستهدفة", "channel": "واتساب | رسالة نصية | بريد إلكتروني | اتصال هاتفي", "timing": "التوقيت", "send_day": "اليوم المقترح", "send_time": "الساعة المقترحة بتوقيت الرياض", "audience_size": "حجم الشريحة التقريبي", "goal": "الهدف الرقمي", "message_ar": "نص الرسالة جاهز للإرسال بصيغة مهنية مع متغيرات مثل {الاسم} و{المشروع}", "variant_b": "نسخة بديلة لاختبار المقارنة", "follow_up": "رسالة المتابعة وتوقيتها إن لم يستجب", "cta": "الدعوة للإجراء والرابط المقترح", "kpi": "مؤشر القياس", "expected_result": "النتيجة المتوقعة رقمياً", "owner": "الجهة المسؤولة" }
    ],
    "calendar": [ { "week": "الأسبوع 1", "tasks": ["مهمة 1", "..."] } ]
  },
  "operational_details": {
    "data_hygiene": ["إجراءات تنقية بيانات الجوالات والأسماء والتكرار"],
    "compliance": ["قواعد الخصوصية وإلغاء الاشتراك والموافقة والتوقيت النظامي"],
    "tools": ["الأدوات/القنوات المطلوبة للتنفيذ"],
    "ab_tests": [ { "test": "اختبار المقارنة بين نسختين", "hypothesis": "الفرضية", "metric": "مؤشر القياس" } ]
  },
  "recommendations": [
    { "title": "عنوان المقترح", "why": "المبرر من الأرقام", "how": ["الخطوة الأولى", "الخطوة الثانية"], "impact": "الأثر المتوقع", "effort": "منخفض | متوسط | مرتفع", "priority": "حرجة | عالية | متوسطة | منخفضة" }
  ],
  "kpi_targets": [ { "kpi": "المؤشر", "current": "القيمة الحالية", "target_90d": "المستهدف بعد 90 يوماً" } ],
  "risks": ["مخاطرة 1", "..."]
}`;

async function callAstra(system: string, payload: unknown, onTick?: () => void) {
  if (!LOVABLE_API_KEY) throw new Error("missing_ai_configuration");
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
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
          text += ev.delta;
          onTick?.();
        }
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "service_configuration_missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = null;
  }
  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { organization_id, metrics, from, to } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const push = (line: string) => {
        if (!closed) controller.enqueue(encoder.encode(line));
      };
      // نبضة كل 10 ثوانٍ حتى لا تُقطع الجلسة أثناء التحليل الطويل
      const beat = setInterval(() => push(".\n"), 10000);
      push(".\n");

      try {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const [orgRes, profRes, externalRes] = await Promise.all([
          admin.from("organizations").select("id,name").eq("id", organization_id).maybeSingle(),
          admin.from("organization_profiles").select("*").eq("organization_id", organization_id).maybeSingle(),
          admin.from("org_external_sources").select("kind,url,label,summary,last_status").eq("organization_id", organization_id),
        ]);
        const org = orgRes.data as any;
        const profile = profRes.data as any;
        const profileUrls: Record<string, unknown> = {
          website: profile?.website_url,
          store: profile?.store_url,
          twitter: profile?.twitter_url,
          instagram: profile?.instagram_url,
          tiktok: profile?.tiktok_url,
          snapchat: profile?.snapchat_url,
          youtube: profile?.youtube_url,
          facebook: profile?.facebook_url,
          linkedin: profile?.linkedin_url,
        };
        const sourcesByUrl = new Map<string, DigitalSource>();
        for (const [kind, rawUrl] of Object.entries(profileUrls)) {
          const url = validHttpUrl(rawUrl);
          if (url) sourcesByUrl.set(url, { kind, label: SOURCE_LABELS[kind] || "مصدر رقمي", url });
        }
        for (const item of externalRes.data || []) {
          const url = validHttpUrl(item.url);
          if (!url) continue;
          const current = sourcesByUrl.get(url);
          const cachedContent = [item.summary, item.last_status ? `حالة آخر مزامنة: ${item.last_status}` : null].filter(Boolean).join("\n");
          const kind = String(item.kind || current?.kind || "other");
          sourcesByUrl.set(url, {
            kind,
            label: String(item.label || current?.label || SOURCE_LABELS[kind] || "مصدر رقمي"),
            url,
            cachedContent: cachedContent || current?.cachedContent,
          });
        }
        const sourceSnapshots = await Promise.all(Array.from(sourcesByUrl.values()).slice(0, 24).map((source) => scrape(source)));
        push(".\n");

        const system = `أنت مستشار تسويق واستدامة مالية للجمعيات الخيرية السعودية، خبير في تحليل متاجر التبرع الإلكترونية وسلوك المتبرعين.
اكتب جميع القيم النصية الظاهرة للقارئ بالعربية الفصحى الاحترافية حصراً، واعتمد على الأرقام المعطاة حرفياً (لا تختلق أرقاماً).
ممنوع استخدام أي كلمة أو اختصار أو حرف لاتيني في المخرجات، بما في ذلك أسماء المؤشرات والقنوات والأولويات والاختبارات والمصطلحات التسويقية. عرّب المصطلحات والأسماء الأجنبية تعريباً واضحاً؛ اكتب «مؤشر الأداء» بدلاً من الاختصار الأجنبي، و«الدعوة إلى الإجراء» بدلاً من الاختصار الأجنبي، و«اختبار المقارنة بين نسختين» بدلاً من رمزه الأجنبي. لا تُرجع روابط إلكترونية داخل النصوص، ويمكن إبقاء مفاتيح بنية JSON الداخلية كما هي لأنها غير ظاهرة للقارئ.
كن مختصراً وعملياً: اذكر 4-6 شرائح للمتبرعين، و4-6 موجات رسائل، و5 مقترحات تنفيذية كحد أقصى، وخطة أسبوعية مختصرة لأربعة أسابيع.
حلّل جميع المصادر الرقمية المرفقة كمدخلات خلفية موحّدة مع بيانات المتجر. لا تذكر أسماء المصادر أو روابطها، ولا تنشئ مراجعة مستقلة لكل موقع أو حساب. أعد في digital_presence خلاصة واحدة فقط: سطران للملخص، ونقطتا قوة، وفجوتان، وثلاثة إجراءات ذات أولوية كحد أقصى.
اجعل headline_findings من 3 إلى 5 نتائج فقط، ولا تكرر المعلومة في أكثر من قسم.
مهم جداً: استخرج أوقات وأيام الإرسال المثالية من الحقل timing في البيانات (أوقات ذروة التبرع الفعلية بتوقيت الرياض) واذكر الساعة واليوم لكل موجة رسائل، مع سقف تكرار الرسائل، والنوافذ الموسمية، والأوقات التي يجب تجنبها.
استخدم أرقام المتبرعين كما هي: الحقل unique_donors للتبرعات المباشرة، والحقل total_reachable_donors_all_channels لقاعدة التواصل الكاملة (لا تخفض هذه الأرقام، ولا تكتب أسماء الحقول الإنجليزية في النص الظاهر).
إلزامي: حلّل كل أقسام store_metrics بلا استثناء ولا تتجاهل أي مجموعة بيانات، وهي أقسام التبرعات والتوقيت وأعلى المشاريع والتوزيع الشهري وأعلى المتبرعين وقنوات التبرع وشرائح المتبرعين والحملات والتبرعات الفاشلة والسلال المتروكة والاستقطاعات والإهداءات واكتمال البيانات. استخدم مفاتيح البيانات الداخلية لفهم المدخلات فقط، ولا تنقل أسماءها الإنجليزية إلى النتيجة.
لكل مجموعة بيانات اذكر صراحةً أرقامها الرئيسية وما تعنيه وإجراءً واحداً على الأقل مبنياً عليها. إذا كانت مجموعة فارغة (صفر) فاذكر ذلك كثغرة بيانات وما يجب فعله لتوفيرها.
اربط الإهداءات والاستقطاع الشهري والسلال المتروكة بشرائح ورسائل مخصصة لكل منها، واستخدم data_coverage لبيان نقص بيانات التواصل (بريد/مدينة) في قسم data_hygiene.
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
          digital_presence_inputs: sourceSnapshots,
        };

        const result = await callAstra(system, payload, () => push("."));

        push(
          "\n__RESULT__" +
            JSON.stringify({
              success: true,
              analysis: result,
            }),
        );
      } catch (e: any) {
        push("\n__RESULT__" + JSON.stringify({ error: String(e?.message || e) }));
      } finally {
        clearInterval(beat);
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
