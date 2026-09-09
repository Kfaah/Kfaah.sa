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
    case "gifts":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")) ?? 0,
        gift_date: toDate(pick(row, "تاريخ الاهداء", "التاريخ", "date")),
        giver_name: pick(row, "اسم المهدي", "المهدي", "giver") as string | null,
        giver_phone: pick(row, "جوال المهدي", "phone") as string | null,
        recipient_name: pick(row, "المهدى اليه", "المهدي اليه", "recipient") as string | null,
        recipient_phone: pick(row, "جوال المهدى اليه", "recipient phone") as string | null,
        occasion: pick(row, "المناسبه", "المناسبة", "occasion") as string | null,
        message: pick(row, "الرساله", "الرسالة", "message") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        raw_data: raw,
      };
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

interface DonorAgg {
  full_name: string;
  phone: string | null;
  total: number;
  count: number;
  first: string | null;
  last: string | null;
}

function segmentOf(a: DonorAgg): string {
  if (a.total >= 5000) return "متبرع كبير";
  if (a.count >= 2) return "متكرر";
  return "جديد";
}

/**
 * يبني/يحدّث ملفات المتبرعين من جدول التبرعات الفعلي للجمعية،
 * حتى تظهر قائمة المتبرعين والتصنيفات في مركز التبرعات.
 */
async function buildDonorProfiles(orgId: string): Promise<void> {
  const PAGE = 1000;
  const byPhone = new Map<string, DonorAgg>();

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("donations")
      .select("donor_name,donor_phone,amount,donation_date")
      .eq("organization_id", orgId)
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn("donor aggregation failed", error.message);
      return;
    }
    if (!data || data.length === 0) break;

    for (const d of data) {
      const phone = d.donor_phone ? String(d.donor_phone).trim() : null;
      const name = (d.donor_name ? String(d.donor_name).trim() : "") || "متبرع غير معروف";
      const key = phone || `name:${name}`;
      const amount = Number(d.amount || 0);
      const date = d.donation_date ? new Date(d.donation_date).toISOString() : null;
      const cur = byPhone.get(key);
      if (!cur) {
        byPhone.set(key, { full_name: name, phone, total: amount, count: 1, first: date, last: date });
      } else {
        cur.total += amount;
        cur.count += 1;
        if (date && (!cur.first || date < cur.first)) cur.first = date;
        if (date && (!cur.last || date > cur.last)) cur.last = date;
      }
    }
    if (data.length < PAGE) break;
  }

  const rows = Array.from(byPhone.entries()).map(([key, a]) => ({
    organization_id: orgId,
    external_id: key,
    full_name: a.full_name,
    phone: a.phone,
    segment: segmentOf(a),
    total_donated: Math.round(a.total * 100) / 100,
    donations_count: a.count,
    first_donation_at: a.first,
    last_donation_at: a.last,
  }));

  const BATCH = 400;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("donors")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "organization_id,external_id" });
    if (error) console.warn("donor upsert failed", error.message);
  }
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

  const mapped = rows
    .map((r) => mapRow(detected, r, orgId, uploadId))
    .filter((r): r is Record<string, unknown> => r !== null);

  let inserted = 0;
  let failed = 0;
  let done = 0;
  const conflict = CONFLICT_TARGET[detected];
  const BATCH = 1000;
  const CONCURRENCY = 5;

  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < mapped.length; i += BATCH) batches.push(mapped.slice(i, i + BATCH));

  const runBatch = async (batch: Record<string, unknown>[]) => {
    const table = supabase.from(detected as never);
    const { error } = conflict
      ? await table.upsert(batch as never, {
          onConflict: conflict,
          ignoreDuplicates: true,
        })
      : await table.insert(batch as never);

    if (error) {
      failed += batch.length;
      console.warn("batch import failed", error.message);
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
