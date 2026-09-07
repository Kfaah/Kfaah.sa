// يحلّل ملفاً مؤرشفاً من مركز الملفات بالذكاء الاصطناعي ويخزّن الملخص والتوصيات.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_CHARS = 40000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function extractPlainText(name: string, bytes: Uint8Array): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text || "");
  }
  if (/\.(txt|csv|md|json|xml|html?)$/.test(lower)) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (/\.(docx|xlsx|pptx)$/.test(lower)) {
    // مستندات Office مضغوطة: نستخرج النصوص الظاهرة من محتوى XML بشكل تقريبي.
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const words = raw.match(/[\p{L}\p{N}][\p{L}\p{N}\s.,؛:%-]{3,}/gu) || [];
    return words.join(" ");
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const uploadId = body?.upload_id as string | undefined;
    if (!uploadId) return json({ error: "upload_id required" }, 400);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: row, error: rowErr } = await supa
      .from("data_uploads_log")
      .select("id, organization_id, file_name, file_type, file_path, storage_bucket, detected_schema")
      .eq("id", uploadId)
      .maybeSingle();
    if (rowErr || !row) return json({ error: "not_found" }, 404);
    if (!row.file_path) return json({ error: "no_file", message: "هذا السجل لا يحتوي على ملف محفوظ." }, 400);

    // التحقق من الصلاحية: super_admin أو admin/manager معتمد في نفس الجمعية.
    const [{ data: roles }, { data: membership }] = await Promise.all([
      supa.from("user_roles").select("role").eq("user_id", user.id),
      supa
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("organization_id", row.organization_id)
        .eq("approval_status", "approved")
        .maybeSingle(),
    ]);
    const roleNames = new Set((roles || []).map((r: { role: string }) => r.role));
    const canAccess =
      roleNames.has("super_admin") ||
      ((roleNames.has("admin") || roleNames.has("moderator")) && Boolean(membership));
    if (!canAccess) return json({ error: "forbidden" }, 403);

    const { data: blob, error: dlErr } = await supa.storage
      .from(row.storage_bucket || "org-documents")
      .download(row.file_path);
    if (dlErr || !blob) return json({ error: "download_failed", message: dlErr?.message }, 400);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      return json({ error: "too_large", message: "الملف أكبر من الحد المسموح للتحليل (30MB)." }, 400);
    }

    let text = "";
    try {
      text = await extractPlainText(row.file_name, bytes);
    } catch (e) {
      console.warn("extract failed", e);
    }
    text = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);

    if (text.length < 80) {
      return json(
        {
          error: "no_text",
          message:
            "تعذّر استخراج نص قابل للتحليل من هذا الملف (قد يكون صورة ممسوحة أو صيغة غير مدعومة).",
        },
        422,
      );
    }

    const { data: org } = await supa
      .from("organizations")
      .select("name")
      .eq("id", row.organization_id)
      .maybeSingle();

    const prompt = `أنت محلل خبير في القطاع غير الربحي. حلّل محتوى الملف التالي الخاص بجمعية "${org?.name || ""}".

اسم الملف: ${row.file_name}
التصنيف: ${row.detected_schema || "غير محدد"}

محتوى الملف:
"""
${text}
"""

أعد JSON فقط بهذا الشكل:
{
  "document_type": "نوع المستند",
  "summary": "ملخص شامل في 3-5 أسطر",
  "key_points": ["نقطة مهمة 1", "نقطة 2"],
  "numbers": ["أي أرقام أو مؤشرات مهمة وردت"],
  "strengths": ["ما يعكسه المستند من قوة"],
  "gaps": ["فجوات أو مخاطر"],
  "recommendations": ["توصية عملية قابلة للتنفيذ"],
  "suggested_tasks": ["مهمة مقترحة للفريق"]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "أعد JSON صحيحاً فقط دون أي نص إضافي." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "rate_limited", message: "تم تجاوز حد الطلبات، حاول بعد قليل." }, 429);
    if (aiRes.status === 402) return json({ error: "payment_required", message: "انتهى رصيد الذكاء الاصطناعي." }, 402);
    if (!aiRes.ok) {
      const details = await aiRes.text();
      return json({ error: "ai_failed", details }, 500);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let analysis: unknown;
    try {
      analysis = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      analysis = { summary: raw };
    }

    const { error: updErr } = await supa
      .from("data_uploads_log")
      .update({
        ai_analysis: analysis,
        ai_analyzed_at: new Date().toISOString(),
        ai_model: "google/gemini-2.5-flash",
      })
      .eq("id", uploadId);
    if (updErr) return json({ error: "save_failed", message: updErr.message }, 500);

    return json({ success: true, analysis, chars: text.length });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
