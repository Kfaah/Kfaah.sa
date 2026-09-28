import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizationErrorResponse, requireOrganizationAccess } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchSnippet(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 KfaahBot" },
    });
    clearTimeout(t);
    if (!res.ok) return `[تعذّر الوصول: ${res.status}]`;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000);
  } catch (e) {
    return `[خطأ: ${(e as Error).message}]`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    await requireOrganizationAccess(req, organization_id, sb);

    const { data: org } = await sb.from("organizations").select("*").eq("id", organization_id).single();
    const { data: profile } = await sb
      .from("organization_profiles")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sources: { label: string; url: string; content: string }[] = [];
    const linkFields: [string, string][] = [
      ["الموقع الإلكتروني", "website_url"],
      ["المتجر الإلكتروني", "store_url"],
      ["تويتر", "twitter_url"],
      ["إنستغرام", "instagram_url"],
      ["تيك توك", "tiktok_url"],
      ["سناب شات", "snapchat_url"],
      ["يوتيوب", "youtube_url"],
      ["فيسبوك", "facebook_url"],
      ["لينكدإن", "linkedin_url"],
    ];
    for (const [label, key] of linkFields) {
      const url = (profile as Record<string, unknown>)[key] as string | null;
      if (url) {
        const content = await fetchSnippet(url);
        sources.push({ label, url, content });
      }
    }

    const docs = Array.isArray((profile as Record<string, unknown>).documents)
      ? ((profile as Record<string, unknown>).documents as Array<{ url?: string; title?: string; type?: string }>)
      : [];
    const docsBlock = docs.length
      ? docs
          .slice(0, 60)
          .map((d, i) => `${i + 1}. [${d.type || "ملف"}] ${d.title || "مستند"} — ${d.url || ""}`)
          .join("\n")
      : "(لا يوجد)";

    const prompt = `أنت محلل خبير في القطاع غير الربحي. حلّل الجمعية التالية بعمق بناءً على البيانات المتاحة.

اسم الجمعية: ${org?.name || ""}
النبذة المُدخلة: ${profile.about || "(لا يوجد)"}
أهداف الجمعية: ${(profile as Record<string, unknown>).goals || "(لا يوجد)"}

الوثائق واللوائح المرفقة من موقع الجمعية (عناوين الملفات تدل على مستوى الحوكمة والشفافية والبرامج):
${docsBlock}

مصادر تم جلبها:
${sources.map((s) => `--- ${s.label} (${s.url}) ---\n${s.content}`).join("\n\n")}


أعد JSON فقط بالشكل التالي:
{
  "specialization": "تخصص الجمعية الرئيسي",
  "mission": "رسالة الجمعية",
  "target_audience": "الفئات المستهدفة",
  "main_programs": ["برنامج 1", "برنامج 2"],
  "products_services": ["منتج/خدمة في المتجر"],
  "tone_of_voice": "نبرة التواصل في حساباتها",
  "social_presence": "ملخص حضورها على وسائل التواصل",
  "strengths": ["نقطة قوة 1"],
  "opportunities": ["فرصة تسويقية 1"],
  "governance_documents": ["ما تستنتجه من الوثائق واللوائح المرفقة"],
  "recommendations_for_innovation": ["توصية للابتكار مرتبطة بتخصص الجمعية"],
  "summary": "ملخص شامل بثلاث جمل"
}`;

    const aiRes = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KFAAH_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "أعد JSON صحيحاً فقط دون أي نص إضافي." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: "ai_failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: unknown;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: raw };
    }

    await sb
      .from("organization_profiles")
      .update({
        ai_analysis: parsed,
        ai_model: "google/gemini-2.5-flash",
        last_analyzed_at: new Date().toISOString(),
      })
      .eq("organization_id", organization_id);

    return new Response(JSON.stringify({ success: true, analysis: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});