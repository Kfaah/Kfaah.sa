// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_BACKUP_TOKEN")!;
const GITHUB_OWNER = Deno.env.get("GITHUB_BACKUP_OWNER")!;
const GITHUB_REPO = Deno.env.get("GITHUB_BACKUP_REPO")!;

// قائمة الجداول المراد نسخها (الجداول العامة فقط، نتجاوز جداول النظام والـ realtime)
async function listPublicTables(supabase: any): Promise<string[]> {
  // نقرأ من information_schema عبر RPC أو باستعلام مباشر
  const { data, error } = await supabase.rpc("exec_sql_select_tables").catch(() => ({ data: null, error: null }));
  if (data && Array.isArray(data)) return data.map((r: any) => r.table_name);

  // Fallback: قائمة معروفة من الجداول الأساسية في المشروع
  return [
    "organizations", "organization_profiles", "organization_branding",
    "user_organizations", "user_roles", "employees",
    "tasks", "task_messages", "task_attachments", "task_time_baselines",
    "donors", "donations", "donor_spend_summary",
    "expenses", "expense_categories", "expense_allocations", "org_allocation_rules",
    "operational_plans", "operational_plan_items", "operational_plan_columns",
    "executive_plans", "action_plans", "action_plan_tasks",
    "notifications", "conversations", "conversation_participants", "messages",
    "internal_threads", "internal_messages",
    "platform_email_threads", "platform_emails",
    "welcome_backgrounds", "welcome_content",
    "intelligence_profiles", "marketing_campaigns",
    "support_tickets", "support_replies",
    "uploads", "ai_plan_references", "staff_duties_uploads",
    "performance_evaluations", "evidence_files",
  ];
}

async function dumpTable(supabase: any, table: string): Promise<{ rows: any[]; count: number }> {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) {
      // الجدول غير موجود أو لا صلاحية — نتجاوز بهدوء
      return { rows: [], count: 0 };
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
    if (all.length > 500_000) break; // حد أمان
  }
  return { rows: all, count: all.length };
}

function base64Encode(str: string): string {
  // ترميز UTF-8 ثم Base64
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadToGitHub(path: string, content: string, message: string) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const body = {
    message,
    content: base64Encode(content),
    branch: "main",
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub upload failed [${res.status}]: ${txt}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // قراءة نوع التشغيل
  let triggerType: "manual" | "scheduled" = "scheduled";
  let triggeredBy: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.trigger === "manual") triggerType = "manual";
    if (body?.user_id) triggeredBy = body.user_id;
  } catch {}

  // إنشاء سجل بدء العملية
  const { data: logRow, error: logErr } = await supabase
    .from("backup_logs")
    .insert({
      status: "running",
      trigger_type: triggerType,
      triggered_by: triggeredBy,
    })
    .select()
    .single();

  if (logErr || !logRow) {
    return new Response(JSON.stringify({ error: "failed to create log", details: logErr }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const logId = logRow.id;
  const startedAt = Date.now();

  try {
    const tables = await listPublicTables(supabase);
    const dump: Record<string, any[]> = {};
    let totalRows = 0;
    let tablesProcessed = 0;

    for (const t of tables) {
      const { rows, count } = await dumpTable(supabase, t);
      if (count > 0) {
        dump[t] = rows;
        totalRows += count;
        tablesProcessed++;
      }
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const filename = `backup-${yyyy}-${mm}-${dd}-${hhmm}.json`;
    const path = `backups/${yyyy}/${mm}/${filename}`;

    const payload = {
      meta: {
        generated_at: now.toISOString(),
        trigger: triggerType,
        tables_count: tablesProcessed,
        total_rows: totalRows,
        version: 1,
      },
      data: dump,
    };
    const json = JSON.stringify(payload, null, 2);
    const sizeBytes = new TextEncoder().encode(json).length;

    const commitMsg = `Backup ${yyyy}-${mm}-${dd} ${hhmm} UTC (${triggerType}) — ${tablesProcessed} tables, ${totalRows} rows`;
    const ghRes = await uploadToGitHub(path, json, commitMsg);
    const commitSha = ghRes?.commit?.sha ?? null;
    const commitUrl = ghRes?.commit?.html_url ?? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/${path}`;

    const durationSec = (Date.now() - startedAt) / 1000;

    await supabase.from("backup_logs").update({
      status: "success",
      tables_count: tablesProcessed,
      total_rows: totalRows,
      file_size_bytes: sizeBytes,
      github_path: path,
      github_commit_sha: commitSha,
      github_commit_url: commitUrl,
      completed_at: new Date().toISOString(),
      duration_seconds: durationSec,
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: true,
      log_id: logId,
      path,
      tables: tablesProcessed,
      rows: totalRows,
      size_bytes: sizeBytes,
      commit_url: commitUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const durationSec = (Date.now() - startedAt) / 1000;
    await supabase.from("backup_logs").update({
      status: "failed",
      error_message: String(err?.message ?? err),
      error_details: { stack: String(err?.stack ?? "") },
      completed_at: new Date().toISOString(),
      duration_seconds: durationSec,
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: false,
      log_id: logId,
      error: String(err?.message ?? err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});