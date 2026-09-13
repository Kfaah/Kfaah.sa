import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

// استيراد جداول التبرعات وما شابهها من داخل المتصفح (بدون حدود ذاكرة الوظائف السحابية).
// نفس منطق الكشف والتحويل المستخدم في معالج البيانات السحابي.

export type DetectedType =
  | "donations"
  | "failed_donations"
  | "bank_transfers"
  | "abandoned_carts"
  | "campaigns"
  | "subscriptions"
  | "gifts"
  | "unknown";

const CONFLICT_TARGET: Partial<Record<DetectedType, string>> = {
  donations: "organization_id,donation_number",
  bank_transfers: "organization_id,transfer_number",
  abandoned_carts: "organization_id,external_id",
  subscriptions: "organization_id,external_id",
  campaigns: "organization_id,external_id",
  gifts: "organization_id,external_id",
};

function normalize(s: string): string {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}


function detectType(headers: string[]): DetectedType {
  const h = headers.map(normalize);
  const has = (kw: string[]) => kw.some((k) => h.some((x) => x.includes(normalize(k))));

  if (has(["السله", "السلال", "متروكه", "متروكة", "abandoned"])) return "abandoned_carts";
  if (has(["تحويل بنكي", "التحويلات البنكيه", "bank transfer", "رقم التحويل"])) return "bank_transfers";
  if (has(["استقطاع", "اشتراك", "subscription", "شهري"])) return "subscriptions";
  if (has(["حمله", "حملات", "campaign", "هدف الحمله"])) return "campaigns";
  if (has(["اهداء", "إهداء", "gift", "المهدى اليه", "المهدي اليه"])) return "gifts";
  if (has(["فاشله", "فاشلة", "failed", "سبب الفشل"])) return "failed_donations";
  if (has(["تبرع", "donation", "مبلغ", "متبرع"])) return "donations";
  return "unknown";
}

function pick(row: Record<string, unknown>, ...candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const nc = normalize(cand);
    const k = keys.find((key) => normalize(key).includes(nc));
    if (k && row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function serialToIso(n: number): string | null {
  const d = XLSX.SSF.parse_date_code(n);
  if (!d) return null;
  return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0)).toISOString();
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "number") return serialToIso(v);
  const s = String(v).trim();
  if (!s) return null;
  // أرقام Excel التسلسلية قد تصل كنص
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return serialToIso(Number(s));
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const yyyy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(yyyy, Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  return null;
}


function mapRow(
  type: DetectedType,
  row: Record<string, unknown>,
  orgId: string,
  uploadId: string,
): Record<string, unknown> | null {
  const raw = row;
  switch (type) {
    case "donations":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        donation_number: String(
          pick(row, "رقم التبرع", "رقم العملية", "donation number", "رقم العمليه") ??
            crypto.randomUUID(),
        ),
        amount: toNumber(pick(row, "قيمه التبرع", "المبلغ", "amount")) ?? 0,
        currency: String(pick(row, "العمله", "currency") ?? "SAR"),
        donation_date:
          toDate(pick(row, "تاريخ التبرع", "وقت التبرع", "التاريخ", "date")) ??
          new Date().toISOString(),
        donor_name: pick(row, "اسم المتبرع", "المتبرع", "donor name") as string | null,
        donor_phone: pick(row, "الجوال", "رقم الجوال", "phone") as string | null,
        project_name: pick(row, "اسم المشروع", "المشروع", "project") as string | null,
        payment_method: pick(row, "طريقه الدفع", "payment method") as string | null,
        source: pick(row, "مصدر التبرع", "المصدر", "source", "القناه") as string | null,

        status: "success",
        raw_data: raw,
      };
    case "failed_donations":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")),
        attempted_at:
          toDate(pick(row, "التاريخ", "تاريخ المحاوله", "date")) ?? new Date().toISOString(),
        donor_name: pick(row, "اسم المتبرع", "donor name") as string | null,
        donor_phone: pick(row, "الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        payment_method: pick(row, "طريقه الدفع", "payment method") as string | null,
        failure_reason: pick(row, "سبب الفشل", "failure reason", "السبب") as string | null,
        raw_data: raw,
      };
    case "bank_transfers":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")) ?? 0,
        transfer_date:
          toDate(pick(row, "تاريخ التحويل", "التاريخ", "date")) ?? new Date().toISOString(),
        transfer_number: pick(row, "رقم التحويل", "transfer number") as string | null,
        bank_name: pick(row, "البنك", "اسم البنك", "bank") as string | null,
        sender_name: pick(row, "اسم المحول", "المرسل", "sender") as string | null,
        sender_phone: pick(row, "جوال المحول", "phone") as string | null,
        notes: pick(row, "ملاحظات", "notes") as string | null,
        raw_data: raw,
      };
    case "abandoned_carts":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        abandoned_at:
          toDate(pick(row, "تاريخ السله", "تاريخ السلة", "التاريخ", "date")) ??
          new Date().toISOString(),
        amount: toNumber(pick(row, "المبلغ", "amount")),
        donor_name: pick(row, "اسم المتبرع", "donor") as string | null,
        donor_phone: pick(row, "الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        raw_data: raw,
      };
    case "campaigns":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        name: String(pick(row, "اسم الحمله", "اسم الحملة", "campaign name", "الاسم") ?? "حملة"),
        description: pick(row, "الوصف", "description") as string | null,
        goal_amount: toNumber(pick(row, "هدف الحمله", "هدف الحملة", "goal", "الهدف")),
        collected_amount: toNumber(pick(row, "المحصل", "collected", "المبلغ المحصل")) ?? 0,
        donations_count: toNumber(pick(row, "عدد التبرعات", "donations count")) ?? 0,
        start_date:
          toDate(pick(row, "تاريخ البدايه", "تاريخ البداية", "start date"))?.split("T")[0] ?? null,
        end_date:
          toDate(pick(row, "تاريخ النهايه", "تاريخ النهاية", "end date"))?.split("T")[0] ?? null,
        status: "active",
        raw_data: raw,
      };
    case "subscriptions":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")) ?? 0,
        start_date:
          toDate(pick(row, "تاريخ البدايه", "تاريخ البداية", "start date")) ??
          new Date().toISOString(),
        donor_name: pick(row, "اسم المتبرع", "donor") as string | null,
        donor_phone: pick(row, "الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        status: String(pick(row, "الحاله", "الحالة", "status") ?? "active"),
        raw_data: raw,
      };
    case "gifts": {
      const externalId = pick(row, "رقم الاهداء", "رقم الإهداء", "رقم العمليه", "gift number", "id");
      return {
        organization_id: orgId,
        upload_id: uploadId,
        external_id: externalId != null ? String(externalId) : null,
        amount: toNumber(pick(row, "مبلغ الاهداء", "قيمه الاهداء", "المبلغ", "amount")) ?? 0,
        gift_date: toDate(
          pick(row, "وقت الاهداء", "تاريخ الاهداء", "التاريخ", "date", "time"),
        ),
        giver_name: pick(row, "اسم المهدي", "المهدي", "giver") as string | null,
        giver_phone: pick(row, "جوال المهدي", "جوال المهدى", "phone") as string | null,
        recipient_name: pick(
          row,
          "اسم المهدي له",
          "المهدي له",
          "المهدي اليه",
          "المهدى اليه",
          "recipient",
        ) as string | null,
        recipient_phone: pick(
          row,
          "جوال المهدي له",
          "جوال المهدي اليه",
          "recipient phone",
        ) as string | null,
        occasion: pick(row, "المناسبه", "المناسبة", "occasion") as string | null,
        message: pick(row, "الرساله", "الرسالة", "message") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        delivery_status: String(pick(row, "حاله الدفع", "الحاله", "status") ?? "pending"),
        raw_data: raw,
      };
    }

    default:
      return null;
  }
}

export interface ImportResult {
  detected: DetectedType;
  total: number;
  inserted: number;
  failed: number;
}

export interface ImportOptions {
  blob: Blob;
  orgId: string;
  /** معرّف سجل الرفع الموجود (نحدّث نتائجه بدل إنشاء سجل جديد). */
  uploadId: string;
  sourceKind?: string | null;
  onProgress?: (done: number, total: number) => void;
}

/**
 * يبني/يحدّث ملفات المتبرعين من جدول التبرعات الفعلي للجمعية على الخادم،
 * حتى تظهر قائمة المتبرعين والتصنيفات في مركز التبرعات (أسرع وأكثر موثوقية).
 */
async function buildDonorProfiles(orgId: string): Promise<void> {
  const { error } = await supabase.rpc("rebuild_donor_profiles", { p_org: orgId });
  if (error) console.warn("donor profiles rebuild failed", error.message);
}

/**
 * يقرأ ملف Excel/CSV في المتصفح ويُدخل صفوفه في الجدول المناسب،
 * ثم يحدّث سجل الرفع بعدد الصفوف المستوردة.
 */
export async function importDataWorkbook({
  blob,
  orgId,
  uploadId,
  sourceKind,
  onProgress,
}: ImportOptions): Promise<ImportResult> {
  const buffer = await blob.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("لا تحتوي الورقة الأولى على بيانات");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  if (!rows.length) throw new Error("الملف لا يحتوي على صفوف");

  const forcedDonations = sourceKind === "store_master" || sourceKind === "store_daily";
  const knownKinds: DetectedType[] = [
    "donations",
    "failed_donations",
    "bank_transfers",
    "abandoned_carts",
    "campaigns",
    "subscriptions",
    "gifts",
  ];
  const detected: DetectedType = forcedDonations
    ? "donations"
    : knownKinds.includes(sourceKind as DetectedType)
      ? (sourceKind as DetectedType)
      : detectType(Object.keys(rows[0]));

  if (detected === "unknown") {
    throw new Error("تعذر التعرف على نوع بيانات الملف");
  }

  let mapped = rows
    .map((r) => mapRow(detected, r, orgId, uploadId))
    .filter((r): r is Record<string, unknown> => r !== null);

  let inserted = 0;
  let failed = 0;
  let done = 0;
  let lastError: string | null = null;
  const conflict = CONFLICT_TARGET[detected];
  const BATCH = 400;
  const CONCURRENCY = 4;

  // إزالة التكرار داخل الملف نفسه حسب مفتاح التعارض (يمنع فشل الدفعة بالكامل)
  if (conflict) {
    const keys = conflict.split(",").map((k) => k.trim());
    const seen = new Set<string>();
    mapped = mapped.filter((row) => {
      const id = keys.map((k) => String(row[k] ?? "")).join("|");
      if (keys.some((k) => row[k] == null)) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < mapped.length; i += BATCH) batches.push(mapped.slice(i, i + BATCH));

  const pushRows = async (batch: Record<string, unknown>[]) => {
    const table = supabase.from(detected as never);
    const { error } = conflict
      ? await table.upsert(batch as never, { onConflict: conflict, ignoreDuplicates: true })
      : await table.insert(batch as never);
    return error?.message ?? null;
  };

  const runBatch = async (batch: Record<string, unknown>[]) => {
    let err = await pushRows(batch);
    if (err && batch.length > 1) {
      // إعادة المحاولة بدفعات أصغر حتى لا تسقط كل الصفوف بسبب صف واحد
      const half = Math.ceil(batch.length / 2);
      const first = await pushRows(batch.slice(0, half));
      const second = await pushRows(batch.slice(half));
      if (!first) inserted += half;
      else failed += half;
      if (!second) inserted += batch.length - half;
      else failed += batch.length - half;
      err = first ?? second;
      if (err) lastError = err;
    } else if (err) {
      failed += batch.length;
      lastError = err;
      console.warn("batch import failed", err);
    } else {
      inserted += batch.length;
    }
    done += batch.length;
    onProgress?.(Math.min(done, mapped.length), mapped.length);
  };


  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      await runBatch(batch);
    }
  });
  await Promise.all(workers);

  if (detected === "donations") {
    await buildDonorProfiles(orgId);
  }


  await supabase
    .from("data_uploads_log")
    .update({
      detected_schema: detected,
      total_rows: rows.length,
      inserted_rows: inserted,
      failed_rows: failed,
      status: failed > 0 ? "completed_with_errors" : "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", uploadId);

  return { detected, total: rows.length, inserted, failed };
}

export const SPREADSHEET_RE = /\.(xlsx|xls|csv)$/i;
