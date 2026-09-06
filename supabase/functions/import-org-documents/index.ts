// Downloads documents discovered on the organization's website and archives them
// into the organization's file center (storage + data_uploads_log), each into its category.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_FILES = 40;
const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file

type Doc = { url: string; title?: string; type?: string; source_page?: string };

function classify(d: Doc): string {
  const hay = `${d.title || ""} ${d.type || ""} ${d.url}`.toLowerCase();
  if (/(تقرير|تقارير|حصاد|إنجاز|انجاز|سنوي|ربع|report|annual)/.test(hay)) return "reports";
  if (/(لائحة|لوائح|نظام|سياسة|سياسات|حوكمة|دليل|ميثاق|policy|governance|bylaw|regulation)/.test(hay)) return "profiles";
  if (/(تعريف|بروفايل|profile|brochure|كتيب)/.test(hay)) return "profiles";
  if (/(خطة|خطط|مهام|plan|strategy|استراتيج)/.test(hay)) return "tasks";
  return "other";
}

function safeName(url: string, title?: string) {
  let base = "";
  try {
    base = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
  } catch { /* ignore */ }
  if (!base) base = (title || "document").slice(0, 80);
  // strip path traversal and unsafe characters
  base = base.replace(/[\\/]+/g, "_").replace(/\.\.+/g, "_").replace(/[^\p{L}\p{N}._-]+/gu, "_");
  if (!/\.[a-z0-9]{2,5}$/i.test(base)) base += ".pdf";
  return base.slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supa.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const organization_id = body?.organization_id as string | undefined;
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Documents come from the request or from the saved profile
    let docs: Doc[] = Array.isArray(body?.documents) ? body.documents : [];
    if (docs.length === 0) {
      const { data: p } = await supa
        .from("organization_profiles")
        .select("documents")
        .eq("organization_id", organization_id)
        .maybeSingle();
      const raw = (p as Record<string, unknown> | null)?.documents;
      docs = Array.isArray(raw) ? (raw as Doc[]) : [];
    }
    docs = docs.filter((d) => d?.url && /^https?:\/\//i.test(d.url)).slice(0, MAX_FILES);

    if (docs.length === 0) {
      return new Response(JSON.stringify({ success: true, imported: 0, skipped: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip files already archived (by name) for this organization
    const { data: existing } = await supa
      .from("data_uploads_log")
      .select("file_name")
      .eq("organization_id", organization_id)
      .limit(2000);
    const already = new Set(((existing as { file_name: string }[]) || []).map((r) => r.file_name));

    const results: { url: string; ok: boolean; category?: string; reason?: string }[] = [];
    let imported = 0;
    let skipped = 0;

    for (const d of docs) {
      const category = classify(d);
      const name = safeName(d.url, d.title);
      if (already.has(name)) { skipped++; results.push({ url: d.url, ok: false, reason: "موجود مسبقاً" }); continue; }

      try {
        const r = await fetch(d.url, { redirect: "follow" });
        if (!r.ok) { results.push({ url: d.url, ok: false, reason: `HTTP ${r.status}` }); continue; }
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
          results.push({ url: d.url, ok: false, reason: "حجم غير مناسب" });
          continue;
        }
        const contentType = r.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
        const path = `${organization_id}/archive/${category}/${Date.now()}_${name}`;
        const { error: upErr } = await supa.storage
          .from("data-uploads")
          .upload(path, buf, { contentType, upsert: false });
        if (upErr) { results.push({ url: d.url, ok: false, reason: upErr.message }); continue; }

        const { error: logErr } = await supa.from("data_uploads_log").insert({
          uploaded_by: user.id,
          organization_id,
          file_name: name,
          file_type: contentType,
          detected_schema: category,
          total_rows: 0,
          inserted_rows: 1,
          duplicate_rows: 0,
          failed_rows: 0,
          status: "completed",
          completed_at: new Date().toISOString(),
        });
        if (logErr) { results.push({ url: d.url, ok: false, reason: logErr.message }); continue; }

        already.add(name);
        imported++;
        results.push({ url: d.url, ok: true, category });
      } catch (e) {
        results.push({ url: d.url, ok: false, reason: e instanceof Error ? e.message : "خطأ" });
      }
    }

    return new Response(JSON.stringify({ success: true, imported, skipped, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
