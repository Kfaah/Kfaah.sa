import { automationMode } from "../_shared/automation-policy.ts";
import { RulePlatform } from "../_shared/rule-platform.ts";
// Parse uploaded Excel file with staff duties and create employee_job_duties rows
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "../_shared/vendor/sheetjs-0.20.3.mjs";
import * as cptable from "../_shared/vendor/sheetjs-cpexcel-0.20.3.mjs";
import { parseLocalDocument } from "../_shared/local-document-parser.ts";
XLSX.set_cptable(cptable);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParsedDuty {
  employee_ref: string; // name, email, phone, or username
  title: string;
  description?: string;
  category?: string;
  frequency?: "daily" | "weekly" | "monthly" | "adhoc";
  priority?: "low" | "medium" | "high";
  estimated_time_minutes?: number | null;
  source_sheet: string;
  source_row: number;
  raw: Record<string, unknown>;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeFreq = (v: unknown): ParsedDuty["frequency"] => {
  const s = norm(v);
  if (!s) return "adhoc";
  if (/(يومي|يوم|daily|day)/.test(s)) return "daily";
  if (/(اسبوع|أسبوع|weekly|week)/.test(s)) return "weekly";
  if (/(شهر|monthly|month)/.test(s)) return "monthly";
  return "adhoc";
};

const normalizePriority = (v: unknown): ParsedDuty["priority"] => {
  const s = norm(v);
  if (!s) return "medium";
  if (/(عاجل|عالي|high|urgent|hi)/.test(s)) return "high";
  if (/(منخفض|low|بسيط)/.test(s)) return "low";
  return "medium";
};

const toMinutes = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

// Detect which header keys map to our fields (Arabic + English variants)
const HEADER_MAP: Record<keyof Omit<ParsedDuty, "source_sheet" | "source_row" | "raw">, RegExp[]> = {
  employee_ref: [/(الموظف|اسم الموظف|employee|staff|name|البريد|email|phone|الجوال|username)/i],
  title: [/(المهمة|عنوان|task|duty|title|action)/i],
  description: [/(وصف|تفاصيل|description|details|notes|ملاحظات)/i],
  category: [/(تصنيف|قسم|category|department|نوع)/i],
  frequency: [/(تكرار|دوري|frequency|periodicity)/i],
  priority: [/(اولوية|أولوية|priority)/i],
  estimated_time_minutes: [/(وقت|مدة|دقائق|time|duration|minutes)/i],
};

function detectColumns(headers: string[]) {
  const map: Partial<Record<keyof typeof HEADER_MAP, number>> = {};
  headers.forEach((h, i) => {
    const hs = String(h ?? "");
    for (const key of Object.keys(HEADER_MAP) as (keyof typeof HEADER_MAP)[]) {
      if (map[key] !== undefined) continue;
      if (HEADER_MAP[key].some((rx) => rx.test(hs))) map[key] = i;
    }
  });
  return map;
}

function parseSheet(name: string, rows: unknown[][]): ParsedDuty[] {
  if (!rows || rows.length < 2) return [];
  // Find first non-empty header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if ((rows[i] || []).filter((c) => String(c ?? "").trim()).length >= 2) {
      headerIdx = i;
      break;
    }
  }
  const headers = (rows[headerIdx] || []).map((c) => String(c ?? ""));
  const cols = detectColumns(headers);
  if (cols.title === undefined) return [];

  const out: ParsedDuty[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const title = String(row[cols.title!] ?? "").trim();
    if (!title) continue;
    const employeeRef = String(row[cols.employee_ref ?? -1] ?? "").trim();
    const raw: Record<string, unknown> = {};
    headers.forEach((h, i) => (raw[h || `col_${i}`] = row[i]));

    out.push({
      employee_ref: employeeRef,
      title,
      description:
        cols.description !== undefined ? String(row[cols.description] ?? "").trim() : undefined,
      category:
        cols.category !== undefined ? String(row[cols.category] ?? "").trim() : undefined,
      frequency: normalizeFreq(cols.frequency !== undefined ? row[cols.frequency] : undefined),
      priority: normalizePriority(cols.priority !== undefined ? row[cols.priority] : undefined),
      estimated_time_minutes: toMinutes(
        cols.estimated_time_minutes !== undefined ? row[cols.estimated_time_minutes] : undefined,
      ),
      source_sheet: name,
      source_row: r + 1,
      raw,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { import_id } = body ?? {};
    if (!import_id) {
      return new Response(JSON.stringify({ error: "import_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: imp, error: impErr } = await admin
      .from("staff_duties_imports")
      .select("*")
      .eq("id", import_id)
      .maybeSingle();
    if (impErr || !imp) throw new Error(impErr?.message ?? "import not found");

    if (automationMode(Deno.env.get("KFAAH_AUTOMATION_MODE")) === "rules") {
      const scope = new RulePlatform(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, req.headers.get("Authorization") || "");
      await scope.authenticate(imp.organization_id);
      scope.requireManager();
    }

    await admin
      .from("staff_duties_imports")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", import_id);

    // Download file
    const { data: file, error: dlErr } = await admin.storage
      .from("staff-duties-files")
      .download(imp.file_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "file download failed");

    if (file.size > 30 * 1024 * 1024) throw new Error("حجم الملف يتجاوز حد 30MB.");
    const buf = new Uint8Array(await file.arrayBuffer());
    if (automationMode(Deno.env.get("KFAAH_AUTOMATION_MODE")) === "rules") {
      const preview = await parseLocalDocument({ fileName: imp.file_name || imp.file_path, bytes: buf }, { limits: { maxRows: 10000 } });
      if (preview.truncated) throw new Error("تجاوز الملف حدود الاستخراج الآمن. قسّمه إلى ملفات أصغر.");
    }
    const wb = XLSX.read(buf, { type: "array" });

    const allDuties: ParsedDuty[] = [];
    const sheetSummary: Record<string, number> = {};
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
      const parsed = parseSheet(sheetName, rows as unknown[][]);
      sheetSummary[sheetName] = parsed.length;
      allDuties.push(...parsed);
    }

    // Load org employees once for matching
    const { data: employees } = await admin
      .from("employees")
      .select("id, user_id, full_name, email, phone, username, organization_id")
      .eq("organization_id", imp.organization_id);

    const matchEmployee = (ref: string) => {
      if (!ref || !employees) return null;
      const r = norm(ref);
      return (
        employees.find((e) => norm(e.email) === r) ||
        employees.find((e) => norm(e.username) === r) ||
        employees.find((e) => norm(e.phone) === r) ||
        employees.find((e) => norm(e.full_name) === r) ||
        employees.find(
          (e) => norm(e.full_name).includes(r) || r.includes(norm(e.full_name)),
        ) ||
        null
      );
    };

    // Remove previous import duties for this import_id (idempotent re-runs)
    await admin.from("employee_job_duties").delete().eq("import_id", import_id);

    let imported = 0;
    let matched = 0;
    let unmatched = 0;
    const errors: any[] = [];
    const batchSize = 200;
    for (let i = 0; i < allDuties.length; i += batchSize) {
      const batch = allDuties.slice(i, i + batchSize);
      const rows = batch
        .map((d) => {
          const emp = matchEmployee(d.employee_ref);
          if (emp?.user_id) matched++;
          else unmatched++;
          // Skip rows with no employee match AND no user_id — we still record unmatched count, but only insert matched ones
          if (!emp?.user_id) return null;
          return {
            user_id: emp.user_id,
            employee_id: emp.id,
            organization_id: imp.organization_id,
            title: d.title,
            description: d.description || null,
            category: d.category || null,
            frequency: d.frequency,
            priority: d.priority,
            estimated_time_minutes: d.estimated_time_minutes,
            source: "imported_excel",
            import_id,
            source_sheet: d.source_sheet,
            source_row: d.source_row,
            external_employee_ref: d.employee_ref || null,
            raw_data: d.raw,
            is_active: true,
          };
        })
        .filter(Boolean) as any[];
      if (rows.length === 0) continue;
      const { error: insErr } = await admin.from("employee_job_duties").insert(rows);
      if (insErr) errors.push({ batch: i, error: insErr.message });
      else imported += rows.length;
    }

    const status = errors.length
      ? "partial"
      : imported === 0
        ? "failed"
        : "success";

    await admin
      .from("staff_duties_imports")
      .update({
        status,
        total_rows: allDuties.length,
        imported_duties: imported,
        matched_employees: matched,
        unmatched_rows: unmatched,
        sheet_summary: sheetSummary,
        error_log: errors.length ? errors : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", import_id);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        total_rows: allDuties.length,
        imported,
        matched,
        unmatched,
        sheet_summary: sheetSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("parse-staff-duties-xlsx error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
