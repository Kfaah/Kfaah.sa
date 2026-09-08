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
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
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

    // Authorization is evaluated server-side. The public helper intentionally
    // is not executable by authenticated clients, so do not call it through
    // the user's RLS-scoped client here.
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const [{ data: roles, error: roleError }, { data: membership, error: membershipError }] =
      await Promise.all([
        supa.from("user_roles").select("role").eq("user_id", user.id),
        supa
          .from("user_organizations")
          .select("organization_id, approval_status")
          .eq("user_id", user.id)
          .eq("organization_id", organization_id)
          .eq("approval_status", "approved")
          .maybeSingle(),
      ]);
    const roleNames = new Set((roles || []).map((row: { role: string }) => row.role));
    const canAccess = roleNames.has("super_admin") || (roleNames.has("admin") && Boolean(membership));
    if (roleError || membershipError || !canAccess) {
      console.warn("import-org-documents authorization denied", {
        user_id: user.id,
        organization_id,
        role_error: roleError?.message,
        membership_error: membershipError?.message,
      });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode A: files uploaded directly from the user's device (base64)
    type UpFile = { name?: string; content_type?: string; data_base64?: string };
    const upFiles: UpFile[] = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
    if (upFiles.length > 0) {
      const results: { url: string; ok: boolean; category?: string; reason?: string }[] = [];
      let imported = 0;
      for (const f of upFiles) {
        const rawName = String(f?.name || "document");
        const name = safeName("", rawName);
        try {
          if (!f?.data_base64) { results.push({ url: rawName, ok: false, reason: "ملف فارغ" }); continue; }
          const bin = Uint8Array.from(atob(f.data_base64), (c) => c.charCodeAt(0));
          if (bin.byteLength === 0 || bin.byteLength > MAX_BYTES) {
            results.push({ url: rawName, ok: false, reason: "حجم غير مناسب (الحد 25 ميجابايت)" });
            continue;
          }
          const category = classify({ url: rawName, title: rawName });
          const contentType = f.content_type || "application/octet-stream";
          const path = `${organization_id}/archive/${category}/${Date.now()}_${name}`;
          const { error: upErr } = await supa.storage
            .from("org-documents")
            .upload(path, bin, { contentType, upsert: false });
          if (upErr) { results.push({ url: rawName, ok: false, reason: upErr.message }); continue; }
          const { error: logErr } = await supa.from("data_uploads_log").insert({
            uploaded_by: user.id,
            organization_id,
            file_name: name,
            file_type: contentType,
            detected_schema: category,
            file_path: path,
            storage_bucket: "org-documents",
            total_rows: 0,
            inserted_rows: 1,
            duplicate_rows: 0,
            failed_rows: 0,
            status: "completed",
            completed_at: new Date().toISOString(),
          });
          if (logErr) {
            await supa.storage.from("org-documents").remove([path]);
            results.push({ url: rawName, ok: false, reason: logErr.message });
            continue;
          }
          imported++;
          results.push({ url: rawName, ok: true, category });
        } catch (e) {
          results.push({ url: rawName, ok: false, reason: e instanceof Error ? e.message : "خطأ" });
        }
      }
      return new Response(JSON.stringify({ success: true, imported, skipped: 0, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode B: documents come from the request or from the saved profile

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
        // Many association sites sit behind Cloudflare and reject non-browser agents,
        // so send browser-like headers (and retry once with the site as referer).
        const browserHeaders: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/pdf,application/octet-stream,*/*;q=0.8",
          "Accept-Language": "ar,en;q=0.8",
        };
        let r = await fetch(d.url, { redirect: "follow", headers: browserHeaders });
        if (!r.ok) {
          let referer = d.source_page || "";
          if (!referer) { try { referer = new URL(d.url).origin + "/"; } catch { /* ignore */ } }
          r = await fetch(d.url, {
            redirect: "follow",
            headers: referer ? { ...browserHeaders, Referer: referer } : browserHeaders,
          });
        }
        if (!r.ok) { results.push({ url: d.url, ok: false, reason: `HTTP ${r.status}` }); continue; }
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
          results.push({ url: d.url, ok: false, reason: "حجم غير مناسب" });
          continue;
        }
        let contentType = r.headers.get("content-type")?.split(";")[0]?.trim() || "";
        // Guess from the extension when the server returns html/octet-stream for a real file
        const ext = (name.split(".").pop() || "").toLowerCase();
        const byExt: Record<string, string> = {
          pdf: "application/pdf",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          xls: "application/vnd.ms-excel",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ppt: "application/vnd.ms-powerpoint",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          csv: "text/csv",
        };
        if (!contentType || contentType === "application/octet-stream" || contentType.startsWith("text/html")) {
          contentType = byExt[ext] || contentType || "application/octet-stream";
        }
        // A real HTML error page is not a document
        if (contentType.startsWith("text/html")) {
          results.push({ url: d.url, ok: false, reason: "الرابط يعيد صفحة وليس ملفاً" });
          continue;
        }
        const path = `${organization_id}/archive/${category}/${Date.now()}_${name}`;
        const { error: upErr } = await supa.storage
          .from("org-documents")
          .upload(path, buf, { contentType, upsert: false });
        if (upErr) { results.push({ url: d.url, ok: false, reason: upErr.message }); continue; }

        const { error: logErr } = await supa.from("data_uploads_log").insert({
          uploaded_by: user.id,
          organization_id,
          file_name: name,
          file_type: contentType,
          detected_schema: category,
          file_path: path,
          storage_bucket: "org-documents",
          total_rows: 0,
          inserted_rows: 1,
          duplicate_rows: 0,
          failed_rows: 0,
          status: "completed",
          completed_at: new Date().toISOString(),
        });
        if (logErr) {
          await supa.storage.from("org-documents").remove([path]);
          results.push({ url: d.url, ok: false, reason: logErr.message });
          continue;
        }

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
