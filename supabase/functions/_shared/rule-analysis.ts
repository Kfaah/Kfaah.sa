/** Pure, deterministic calculations. This module performs no I/O and does not authenticate callers. */
export const RULES_SOURCE = "rules-v1" as const;
export type DataRow = Record<string, unknown>;
export type CalendarPeriod = { from: string; to: string; utc_offset_minutes: number };
export type Evidence = {
  source: typeof RULES_SOURCE;
  organization_id: string;
  dataset: string;
  row_ids: string[];
  row_count: number;
  row_ids_truncated: boolean;
  period: CalendarPeriod | null;
  metrics: Record<string, string | number | null>;
  note?: string;
};
export type DataQuality = {
  input_rows: number;
  scoped_rows: number;
  accepted_rows: number;
  invalid_rows: number;
  invalid_values: number;
  unsupported_rows: number;
  excluded_organization_rows: number;
  duplicate_rows: number;
  missing_identity_rows: number;
  missing_currency_rows: number;
  unsupported_currency_rows: number;
  issues: { dataset: string; row_id: string | null; field: string; reason: string }[];
};
export type RuleFinding = {
  rule_id: string;
  insight_type: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  title: string;
  summary: string;
  donor_ref?: string;
  recommended_actions: string[];
  evidence: Evidence;
};

const DAY = 86_400_000;
const SUCCESS = new Set(["success", "successful", "completed", "paid", "ناجح", "ناجحة", "مكتمل", "مكتملة"]);
const NON_SUCCESS = new Set(["pending", "failed", "cancelled", "canceled", "refunded", "قيد الانتظار", "فاشل", "فاشلة", "ملغي", "ملغاة", "مسترد"]);
const PANEL_NAMES: Record<string, string> = {
  overview: "أداء التبرعات", donors: "المتبرعون", donations: "التبرعات", top: "كبار المتبرعين",
  recurring: "المتبرعون المتكررون", subscriptions: "الاستقطاعات", campaigns: "الحملات",
  gifts: "الإهداءات", failed: "التبرعات الفاشلة", abandoned: "السلال المتروكة", elite: "النخبة",
};
const object = (v: unknown): DataRow => v !== null && typeof v === "object" && !Array.isArray(v) ? v as DataRow : {};
const identifier = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isSafeInteger(v) ? String(v) : null;
const text = (v: unknown): string => typeof v === "string" ? v.trim() : "";
const normalizeDigits = (v: string): string => v.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
const quality = (): DataQuality => ({ input_rows: 0, scoped_rows: 0, accepted_rows: 0, invalid_rows: 0, invalid_values: 0, unsupported_rows: 0, excluded_organization_rows: 0, duplicate_rows: 0, missing_identity_rows: 0, missing_currency_rows: 0, unsupported_currency_rows: 0, issues: [] });

/** An explicit currency declaration is required. Generic "riyal" or the shared rial symbol is ambiguous. */
export function supportedCurrency(value: unknown): "SAR" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  return new Set(["SAR", "ر.س", "ر.س.", "ريال سعودي", "الريال السعودي"]).has(normalized) ? "SAR" : null;
}
/** Reject missing, negative, non-finite, malformed and sub-cent amounts instead of coercing them to zero. */
export function parseMoneyToCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) return null;
  const raw = normalizeDigits(String(value).trim()).replace(/\u066b/g, ".").replace(/\u066c/g, ",");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.replace(/,/g, "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = normalizeDigits(String(value).trim());
  if (!/^\d+$/.test(raw)) return null;
  const result = Number(raw);
  return Number.isSafeInteger(result) ? result : null;
}
export function percentageChange(current: number, previous: number): number | null {
  if (![current, previous].every(Number.isFinite) || current < 0 || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}
export function percentage(part: number, total: number): number | null {
  return Number.isFinite(part) && Number.isFinite(total) && part >= 0 && total > 0
    ? Math.round(part / total * 10_000) / 100 : null;
}
function addCents(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new RangeError("Money total exceeds the safe integer range");
  return sum;
}
function validateOffset(offset: number): void {
  if (!Number.isInteger(offset) || offset < -840 || offset > 840) throw new RangeError("Invalid UTC offset");
}
function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1000 || year > 9999) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** Date-only values are calendar dates. Timestamps require an explicit timezone. Saudi time is the default. */
export function calendarDate(value: unknown, utcOffsetMinutes = 180): string | null {
  validateOffset(utcOffsetMinutes);
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return new Date(value.getTime() + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const raw = normalizeDigits(value.trim());
  if (validDateOnly(raw)) return raw;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !validDateOnly(raw.slice(0, 10))) return null;
  const instant = Date.parse(raw);
  if (!Number.isFinite(instant)) return null;
  return new Date(instant + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
}
function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
function shiftMonthClamped(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}
export type CalendarPreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "last_year" | "last_7_days" | "last_30_days" | "last_90_days" | "last_3_months" | "last_6_months" | "last_12_months" | "last_24_months" | "custom";
export function calendarWindow(preset: CalendarPreset, asOf: string | Date, options: { utcOffsetMinutes?: number; from?: string; to?: string } = {}): CalendarPeriod {
  const offset = options.utcOffsetMinutes ?? 180;
  const today = calendarDate(asOf, offset);
  if (!today) throw new RangeError("Invalid analysis date");
  let from = today, to = today;
  const year = Number(today.slice(0, 4));
  const monthStart = today.slice(0, 8) + "01";
  const sunday = shiftDay(today, -new Date(`${today}T00:00:00Z`).getUTCDay());
  switch (preset) {
    case "today": break;
    case "yesterday": from = to = shiftDay(today, -1); break;
    case "this_week": from = sunday; break;
    case "last_week": from = shiftDay(sunday, -7); to = shiftDay(sunday, -1); break;
    case "this_month": from = monthStart; break;
    case "last_month": from = shiftMonthClamped(monthStart, -1); to = shiftDay(monthStart, -1); break;
    case "this_year": from = `${year}-01-01`; break;
    case "last_year": from = `${year - 1}-01-01`; to = `${year - 1}-12-31`; break;
    case "last_7_days": from = shiftDay(today, -6); break;
    case "last_30_days": from = shiftDay(today, -29); break;
    case "last_90_days": from = shiftDay(today, -89); break;
    case "last_3_months": from = shiftMonthClamped(today, -3); break;
    case "last_6_months": from = shiftMonthClamped(today, -6); break;
    case "last_12_months": from = shiftMonthClamped(today, -12); break;
    case "last_24_months": from = shiftMonthClamped(today, -24); break;
    case "custom": {
      const start = calendarDate(options.from, offset), end = calendarDate(options.to, offset);
      if (!start || !end || start > end) throw new RangeError("Invalid custom date range");
      from = start; to = end; break;
    }
    default: throw new RangeError("Unsupported calendar period");
  }
  return { from, to, utc_offset_minutes: offset };
}
function precedingPeriod(period: CalendarPeriod): CalendarPeriod {
  const days = Math.round((Date.parse(period.to) - Date.parse(period.from)) / DAY) + 1;
  return { from: shiftDay(period.from, -days), to: shiftDay(period.from, -1), utc_offset_minutes: period.utc_offset_minutes };
}
const inPeriod = (date: string, period: CalendarPeriod): boolean => date >= period.from && date <= period.to;
function evidence(org: string, dataset: string, ids: string[], period: CalendarPeriod | null, metrics: Evidence["metrics"], note?: string): Evidence {
  const sorted = [...new Set(ids)].sort();
  return { source: RULES_SOURCE, organization_id: org, dataset, row_ids: sorted.slice(0, 200), row_count: sorted.length, row_ids_truncated: sorted.length > 200, period, metrics: { ...metrics, ...(Object.entries(metrics).some(([key, value]) => key.includes("cents") && value !== null) ? { currency: "SAR" } : {}) }, ...(note ? { note } : {}) };
}
function issue(q: DataQuality, dataset: string, rowId: string | null, field: string, reason: string): void {
  q.invalid_values++;
  if (q.issues.length < 100) q.issues.push({ dataset, row_id: rowId, field, reason });
}
function requireSar(value: unknown, dataset: string, rowId: string | null, q: DataQuality, field = "currency", excludeRow = true): boolean {
  if (supportedCurrency(value)) return true;
  if (value === undefined || value === null || text(value) === "") {
    q.missing_currency_rows++;
    if (excludeRow) q.invalid_rows++;
    issue(q, dataset, rowId, field, "missing_or_invalid_currency");
  } else {
    q.unsupported_currency_rows++;
    q.unsupported_rows++;
    if (q.issues.length < 100) q.issues.push({ dataset, row_id: rowId, field, reason: "unsupported_currency" });
  }
  return false;
}
function scopedRows(rows: unknown, dataset: string, org: string, tenantFiltered: boolean, q: DataQuality): DataRow[] {
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) { issue(q, dataset, null, dataset, "expected_array"); return []; }
  const byId = new Map<string, DataRow>(), signatures = new Map<string, string>(), conflicts = new Set<string>();
  for (const value of rows) {
    q.input_rows++;
    const row = object(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) { q.invalid_rows++; issue(q, dataset, null, "row", "expected_object"); continue; }
    const rowOrg = identifier(row.organization_id ?? row.org_id);
    if (rowOrg !== org && !(row.organization_id === undefined && row.org_id === undefined && tenantFiltered)) { q.excluded_organization_rows++; continue; }
    q.scoped_rows++;
    const id = identifier(row.id);
    if (!id) { q.invalid_rows++; issue(q, dataset, null, "id", "missing_identifier"); continue; }
    const signature = JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
    if (signatures.has(id)) {
      q.duplicate_rows++;
      if (conflicts.has(id)) { q.invalid_rows++; continue; }
      if (signatures.get(id) !== signature) {
        conflicts.add(id); byId.delete(id); q.invalid_rows += 2;
        issue(q, dataset, id, "id", "conflicting_duplicate_identifier");
      }
      continue;
    }
    signatures.set(id, signature);
    byId.set(id, { ...row, id });
  }
  return [...byId.values()];
}
const moneyText = (cents: number): string => `${(cents / 100).toFixed(2)} ر.س`;
const percentText = (value: number | null): string => value === null ? "غير قابل للحساب لغياب أساس صالح" : `${value}%`;

export type DonorDataInput = {
  organizationId: string;
  asOf: string | Date;
  donations: readonly DataRow[];
  donors?: readonly DataRow[];
  subscriptions?: readonly DataRow[];
  campaigns?: readonly DataRow[];
  gifts?: readonly DataRow[];
  abandonedCarts?: readonly DataRow[];
  failedDonations?: readonly DataRow[];
  /** Only set after the caller fetched every input table with an authenticated organization filter. */
  tenantFiltered?: boolean;
  utcOffsetMinutes?: number;
  majorDonorThresholdCents?: number;
  /** Mark capped/partial database reads; the result will disclose that rates cover observed records only. */
  incomplete?: boolean;
};
type Donation = { id: string; donor_id: string | null; amount_cents: number; date: string; project: string };
export function summarizeDonorData(input: DonorDataInput) {
  const org = identifier(input.organizationId);
  if (!org) throw new TypeError("organizationId is required");
  const offset = input.utcOffsetMinutes ?? 180;
  const today = calendarDate(input.asOf, offset);
  if (!today) throw new RangeError("Invalid analysis date");
  const threshold = input.majorDonorThresholdCents ?? 1_000_000;
  if (!Number.isSafeInteger(threshold) || threshold <= 0) throw new RangeError("Invalid major donor threshold");
  const q = quality();
  const scope = (rows: unknown, dataset: string) => scopedRows(rows, dataset, org, input.tenantFiltered === true, q);
  const donations: Donation[] = [];
  for (const row of scope(input.donations, "donations")) {
    const id = String(row.id), status = text(row.status).toLowerCase();
    if (!SUCCESS.has(status)) {
      q.unsupported_rows++;
      if (!NON_SUCCESS.has(status) && q.issues.length < 100) q.issues.push({ dataset: "donations", row_id: id, field: "status", reason: "unknown_or_missing_success_status" });
      continue;
    }
    if (!requireSar(row.currency, "donations", id, q)) continue;
    const cents = parseMoneyToCents(row.amount), date = calendarDate(row.donation_date, offset);
    if (cents === null) issue(q, "donations", id, "amount", "invalid_nonnegative_money");
    if (!date || date > today) issue(q, "donations", id, "donation_date", date ? "future_date" : "invalid_date");
    if (cents === null || !date || date > today) { q.invalid_rows++; continue; }
    const donorId = identifier(row.donor_id);
    if (!donorId) q.missing_identity_rows++;
    donations.push({ id, donor_id: donorId, amount_cents: cents, date, project: text(row.project_name) || "غير محدد" });
    q.accepted_rows++;
  }
  donations.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const todayPeriod = calendarWindow("today", today, { utcOffsetMinutes: offset });
  const yesterday = calendarWindow("yesterday", today, { utcOffsetMinutes: offset });
  const period30 = calendarWindow("last_30_days", today, { utcOffsetMinutes: offset });
  const previous30 = precedingPeriod(period30);
  const period90 = calendarWindow("last_90_days", today, { utcOffsetMinutes: offset });
  const previous90 = precedingPeriod(period90);
  const total = (rows: Donation[]) => rows.reduce((sum, row) => addCents(sum, row.amount_cents), 0);
  const periodTotal = (period: CalendarPeriod) => {
    const rows = donations.filter(row => inPeriod(row.date, period));
    return { period, count: rows.length, amount_cents: total(rows), donor_count: new Set(rows.map(row => row.donor_id).filter(Boolean)).size, evidence: evidence(org, "donations", rows.map(row => row.id), period, { count: rows.length, amount_cents: total(rows) }) };
  };
  const todayTotal = periodTotal(todayPeriod), yesterdayTotal = periodTotal(yesterday);
  const currentTotal = periodTotal(period30), previousTotal = periodTotal(previous30);
  const donorGroups = new Map<string, Donation[]>();
  for (const row of donations) if (row.donor_id) {
    const group = donorGroups.get(row.donor_id) ?? [];
    group.push(row); donorGroups.set(row.donor_id, group);
  }
  const majorPrevious = [...donorGroups.entries()].filter(([, rows]) => total(rows.filter(row => inPeriod(row.date, previous90))) >= threshold);
  const retained = majorPrevious.filter(([, rows]) => rows.some(row => row.amount_cents > 0 && inPeriod(row.date, period90)));
  const notObserved = majorPrevious.filter(([, rows]) => !rows.some(row => row.amount_cents > 0 && inPeriod(row.date, period90)));
  const majorEvidence = evidence(org, "donations", majorPrevious.flatMap(([, rows]) => rows.filter(row => inPeriod(row.date, previous90) || inPeriod(row.date, period90)).map(row => row.id)), { ...previous90, to: period90.to }, { previous_donors: majorPrevious.length, retained_donors: retained.length, retention_percent: percentage(retained.length, majorPrevious.length), threshold_cents: threshold }, "Cohort is defined by prior-period giving; retention means any positive observed gift in the current period. No future behavior is inferred.");
  const findings: RuleFinding[] = [];
  function addFinding(finding: Omit<RuleFinding, "rule_id">, ruleId: string) { findings.push({ rule_id: ruleId, ...finding }); }
  if (donations.length) addFinding({ insight_type: "other", category: "performance", severity: "info", title: "مقارنة التبرعات خلال فترتين متساويتين", summary: `بلغت التبرعات الناجحة ${moneyText(currentTotal.amount_cents)} في ${period30.from} إلى ${period30.to}، مقابل ${moneyText(previousTotal.amount_cents)} في ${previous30.from} إلى ${previous30.to}. التغير: ${percentText(percentageChange(currentTotal.amount_cents, previousTotal.amount_cents))}.`, recommended_actions: ["راجع اكتمال بيانات الفترتين قبل تفسير الفرق أو اتخاذ إجراء."], evidence: evidence(org, "donations", donations.filter(row => inPeriod(row.date, period30) || inPeriod(row.date, previous30)).map(row => row.id), { ...previous30, to: period30.to }, { current_cents: currentTotal.amount_cents, previous_cents: previousTotal.amount_cents, change_percent: percentageChange(currentTotal.amount_cents, previousTotal.amount_cents) }) }, "giving-comparison-30d");
  if (majorPrevious.length) addFinding({ insight_type: "other", category: "retention", severity: notObserved.length ? "medium" : "info", title: "استمرار عطاء كبار المتبرعين في البيانات المتاحة", summary: `من ${majorPrevious.length} متبرع بلغ عطاؤهم ${moneyText(threshold)} أو أكثر في ${previous90.from} إلى ${previous90.to}، ظهر عطاء جديد لـ ${retained.length} خلال ${period90.from} إلى ${period90.to} (${percentText(percentage(retained.length, majorPrevious.length))}). لم يظهر عطاء لـ ${notObserved.length} في هذه الفترة؛ هذا وصف للسجلات وليس توقعاً للانقطاع.`, recommended_actions: notObserved.length ? ["راجع سجل المتبرعين واكتمال الاستيراد قبل إعداد متابعة مناسبة عبر القنوات المصرح بها."] : ["راجع تقارير الأثر والشكر للمتبرعين المستمرين."], evidence: majorEvidence }, "major-donor-retention-90d");
  const donorRows = scope(input.donors, "donors");
  const donorCount = donorRows.length;
  q.accepted_rows += donorRows.length;
  let activeSubscriptions = 0, activeCampaigns = 0, gifts90 = 0, abandoned72 = 0, failed30 = 0;
  for (const row of scope(input.subscriptions, "subscriptions")) {
    q.accepted_rows++;
    if (text(row.status).toLowerCase() !== "active") continue;
    activeSubscriptions++;
    if (row.next_charge_date == null || row.next_charge_date === "") continue;
    const due = calendarDate(row.next_charge_date, offset);
    if (!due) { issue(q, "subscriptions", String(row.id), "next_charge_date", "invalid_date"); continue; }
    if (due < today) addFinding({ insight_type: "lapsing_recurring", category: "retention", severity: "medium", title: "استقطاع نشط بتاريخ تحصيل مضى", summary: `الاستقطاع ${row.id} نشط، وتاريخ التحصيل المسجل ${due}. يلزم التحقق من آخر عملية؛ لا يثبت التاريخ وحده فشل التحصيل.`, ...(identifier(row.donor_id) ? { donor_ref: String(row.donor_id) } : {}), recommended_actions: ["تحقق من حالة التحصيل وتحديث تاريخ الاستحقاق قبل التواصل."], evidence: evidence(org, "subscriptions", [String(row.id)], todayPeriod, { next_charge_date: due }) }, `subscription-review:${row.id}`);
  }
  for (const row of scope(input.campaigns, "campaigns")) {
    q.accepted_rows++;
    if (text(row.status).toLowerCase() !== "active") continue;
    activeCampaigns++;
    if (!requireSar(row.currency, "campaigns", String(row.id), q, "currency", false)) continue;
    const goal = parseMoneyToCents(row.goal_amount), collected = parseMoneyToCents(row.collected_amount);
    if (goal === null || goal === 0) issue(q, "campaigns", String(row.id), "goal_amount", "invalid_positive_goal");
    if (collected === null) issue(q, "campaigns", String(row.id), "collected_amount", "invalid_nonnegative_money");
    if (goal === null || goal === 0 || collected === null) continue;
    if (collected >= goal * 0.8 && collected < goal) addFinding({ insight_type: "campaign_near_goal", category: "growth", severity: "info", title: `حملة قريبة من هدفها: ${text(row.name) || row.id}`, summary: `المحصل ${moneyText(collected)} من هدف ${moneyText(goal)} (${percentText(percentage(collected, goal))})؛ المتبقي ${moneyText(goal - collected)}.`, recommended_actions: ["راجع موعد نهاية الحملة وصحة التحصيل ثم جهز تحديثاً موثقاً عن المتبقي."], evidence: evidence(org, "campaigns", [String(row.id)], todayPeriod, { goal_cents: goal, collected_cents: collected, remaining_cents: goal - collected }) }, `campaign-near-goal:${row.id}`);
  }
  const recentRows = (rows: unknown, dataset: string, dateField: string, period: CalendarPeriod) => {
    const result: { row: DataRow; date: string; cents: number | null }[] = [];
    for (const row of scope(rows, dataset)) {
      const date = calendarDate(row[dateField], offset);
      if (!date || date > today) {
        issue(q, dataset, String(row.id), dateField, date ? "future_date" : "invalid_date");
        q.invalid_rows++; continue;
      }
      // These schemas may not store currency. The activity remains valid even when its money is unavailable.
      const monetaryEligible = requireSar(row.currency, dataset, String(row.id), q, "currency", false);
      const cents = parseMoneyToCents(row.amount);
      if (cents === null) issue(q, dataset, String(row.id), "amount", "invalid_nonnegative_money");
      q.accepted_rows++;
      if (inPeriod(date, period)) result.push({ row, date, cents: monetaryEligible ? cents : null });
    }
    return result;
  };
  const activityAmount = (rows: { cents: number | null }[]): number | null => rows.some(row => row.cents === null) ? null : rows.reduce((sum, row) => addCents(sum, row.cents as number), 0);
  const giftRows = recentRows(input.gifts, "gifts", "gift_date", period90);
  gifts90 = giftRows.length;
  const cartPeriod = { ...todayPeriod, from: shiftDay(today, -2) };
  // Calendar days, explicitly labelled; do not pretend date-only data defines an exact rolling 72 hours.
  const carts = recentRows(input.abandonedCarts, "abandoned_carts", "abandoned_at", cartPeriod).filter(({ row }) => row.recovered !== true && text(row.follow_up_status).toLowerCase() !== "recovered");
  abandoned72 = carts.length;
  if (carts.length) {
    const amount = activityAmount(carts);
    const unavailable = carts.filter(cart => cart.cents === null).length;
    addFinding({ insight_type: "abandoned_cart_recovery", category: "recovery", severity: "medium", title: "سلال غير مستردة خلال آخر ثلاثة أيام تقويمية", summary: `${carts.length} سلة من ${cartPeriod.from} إلى ${cartPeriod.to}. ${amount === null ? `القيمة النقدية الإجمالية غير متاحة: ${unavailable} سجل بلا مبلغ صالح بعملة سعودية معلنة.` : `القيمة المدخلة ${moneyText(amount)}؛ ليست إيراداً محصلاً أو إيراداً مضمون الاسترداد.`}`, recommended_actions: ["تحقق من عدم إتمام التبرع ومن تفضيلات التواصل قبل إعداد متابعة."], evidence: evidence(org, "abandoned_carts", carts.map(({ row }) => String(row.id)), cartPeriod, { count: carts.length, amount_cents: amount, amount_unavailable_rows: unavailable }) }, "unrecovered-carts-3-calendar-days");
  }
  const failed = recentRows(input.failedDonations, "failed_donations", "attempted_at", period30);
  failed30 = failed.length;
  if (failed.length) addFinding({ insight_type: "other", category: "recovery", severity: "medium", title: "محاولات تبرع مسجلة كفاشلة", summary: `توجد ${failed.length} محاولة في ${period30.from} إلى ${period30.to}. لا تشمل إجمالي التبرعات الناجحة ولا تثبت استمرار تعطل وسيلة الدفع.`, recommended_actions: ["راجع أسباب الفشل وحالة إعادة المحاولة قبل أي تواصل."], evidence: evidence(org, "failed_donations", failed.map(({ row }) => String(row.id)), period30, { count: failed.length }) }, "failed-donations-30d");
  const firstDate = donations[0]?.date ?? null;
  const allPeriod = firstDate ? { ...todayPeriod, from: firstDate } : todayPeriod;
  const amount = total(donations);
  const repeat = [...donorGroups.values()].filter(rows => rows.filter(row => row.amount_cents > 0).length >= 2).length;
  const projects = new Map<string, { amount_cents: number; count: number; ids: string[] }>();
  for (const row of donations) {
    const project = projects.get(row.project) ?? { amount_cents: 0, count: 0, ids: [] };
    project.amount_cents = addCents(project.amount_cents, row.amount_cents); project.count++; project.ids.push(row.id); projects.set(row.project, project);
  }
  const summary = {
    source: RULES_SOURCE, organization_id: org, currency: "SAR" as const, today, period: allPeriod,
    totals: { donations: donations.length, donations_amount: amount / 100, donations_amount_cents: amount, donors: input.donors === undefined ? null : donorCount, observed_donors: donorGroups.size, active_subscriptions: input.subscriptions === undefined ? null : activeSubscriptions, active_campaigns: input.campaigns === undefined ? null : activeCampaigns, gifts_90d: input.gifts === undefined ? null : gifts90, abandoned_3_calendar_days: input.abandonedCarts === undefined ? null : abandoned72, failed_30d: input.failedDonations === undefined ? null : failed30, gifts_90d_amount_cents: input.gifts === undefined ? null : activityAmount(giftRows), abandoned_3_calendar_days_amount_cents: input.abandonedCarts === undefined ? null : activityAmount(carts), failed_30d_amount_cents: input.failedDonations === undefined ? null : activityAmount(failed) },
    comparisons: { today: todayTotal, yesterday: yesterdayTotal, today_change_percent: percentageChange(todayTotal.amount_cents, yesterdayTotal.amount_cents), current_30_days: currentTotal, previous_30_days: previousTotal, change_30_days_percent: percentageChange(currentTotal.amount_cents, previousTotal.amount_cents) },
    cohorts: { observed_donors: donorGroups.size, repeat_donors: repeat, repeat_percent: percentage(repeat, donorGroups.size), unidentified_donation_rows: q.missing_identity_rows, major_retention: { threshold_cents: threshold, previous_period: previous90, current_period: period90, previous_donors: majorPrevious.length, retained_donors: retained.length, not_observed_donor_ids: notObserved.map(([id]) => id).sort(), retention_percent: percentage(retained.length, majorPrevious.length), evidence: majorEvidence } },
    top_projects: [...projects.entries()].sort((a, b) => b[1].amount_cents - a[1].amount_cents || a[0].localeCompare(b[0])).slice(0, 8).map(([project, value]) => ({ project, amount_cents: value.amount_cents, count: value.count, evidence: evidence(org, "donations", value.ids, allPeriod, { amount_cents: value.amount_cents, count: value.count }) })),
    findings: findings.sort((a, b) => a.rule_id.localeCompare(b.rule_id)), quality: q,
    evidence: evidence(org, "donations", donations.map(row => row.id), allPeriod, { donations: donations.length, amount_cents: amount, observed_donors: donorGroups.size }),
    limitations: ["النتائج تصف السجلات المتاحة فقط ولا تتنبأ بسلوك المتبرعين أو تفسر أسباب التغير.", "الأرقام المالية والشرائح المرتبطة بها تخص السجلات المصرح بعملتها SAR أو ريال سعودي فقط؛ تُستبعد العملات المفقودة والأخرى دون تحويل عملات. تُحسب الأموال بوحدات الهللة، وتُستبعد المبالغ والتواريخ غير الصالحة وحالات التبرع غير الناجحة.", "أعداد الإهداءات والسلال والمحاولات الفاشلة تحصي الأنشطة ذات التواريخ الصالحة حتى عند غياب عملتها؛ عندئذ تكون القيمة النقدية غير متاحة.", "تُربط تبرعات الشخص بمعرّف المتبرع فقط؛ الأسماء والهواتف لا تكفي لإثبات تطابق الهوية.", ...(input.donors === undefined ? ["عدد المتبرعين المسجلين غير متاح؛ observed_donors يحصي المعرّفات الظاهرة في التبرعات فقط."] : []), ...(input.incomplete ? ["مصدر البيانات جزئي أو محدود الصفوف؛ لا تمثل الأرقام إجمالي الجمعية أو معدل احتفاظ شاملاً."] : [])],
  };
  return summary;
}
export type DonorSummary = ReturnType<typeof summarizeDonorData>;

type InsightSection = { title: string; description: string; evidence?: Evidence; template?: boolean };
export type DonorInsightOptions = { organizationId: string; asOf?: string | Date; summary?: DonorSummary };
/** Preserves the existing donor-insights JSON contract; all additional fields are additive. */
export function generateDonorInsights(payloadValue: unknown, options: DonorInsightOptions) {
  const org = identifier(options.organizationId);
  if (!org) throw new TypeError("organizationId is required");
  const payload = object(payloadValue);
  for (const field of ["organization_id", "organizationId", "org_id"]) {
    if (payload[field] !== undefined && identifier(payload[field]) !== org) throw new TypeError("Organization scope mismatch");
  }
  if (options.summary && options.summary.organization_id !== org) throw new TypeError("Organization scope mismatch");
  const panel = text(payload.panel) || "elite";
  const context = options.summary ? {} : payload.panel ? object(payload.context) : payload;
  const q = options.summary ? structuredClone(options.summary.quality) : quality();
  const period = options.summary?.period ?? null;
  const analysisDate = options.asOf ? calendarDate(options.asOf) : options.summary?.today ?? null;
  if (options.asOf && !analysisDate) throw new RangeError("Invalid analysis date");
  const metrics: Record<string, number | null> = {};
  const proofs: Evidence[] = [];
  const segments: InsightSection[] = [], retention: InsightSection[] = [], campaigns: InsightSection[] = [], drafts: InsightSection[] = [], tierActions: InsightSection[] = [];
  const limitations = options.summary ? [...options.summary.limitations] : ["المقاييس مستمدة من الملخص المرسل؛ لم يُتحقق هنا من اكتمال السجلات أو حداثتها أو هوية المتبرعين.", "لا يمكن حساب الاحتفاظ بكبار المتبرعين من مبالغ إجمالية أو عينة مجهولة وحدها؛ يلزم ربط هوية المتبرع بفترتين محددتين."];
  const makeProof = (path: string, values: Evidence["metrics"]) => {
    const proof = evidence(org, options.summary ? "donations" : "supplied_aggregate", options.summary ? options.summary.evidence.row_ids : [`aggregate:${path}`], options.summary ? options.summary.period : null, values, options.summary ? undefined : "Supplied aggregate, not individually verified source rows; observation period is not provided.");
    if (options.summary) {
      proof.row_count = options.summary.evidence.row_count;
      proof.row_ids_truncated = options.summary.evidence.row_ids_truncated;
    }
    proofs.push(proof); return proof;
  };
  const count = (key: string, value: unknown, path = key): number | null => {
    if (value === undefined) return null;
    const n = parseNonNegativeInteger(value);
    if (n === null) issue(q, "supplied_aggregate", `aggregate:${path}`, path, "invalid_nonnegative_integer");
    else metrics[key] = n;
    return n;
  };
  const declaredCurrency = options.summary ? "SAR" : context.currency !== undefined ? context.currency : payload.currency;
  const money = (key: string, value: unknown, path = key, currency: unknown = declaredCurrency): number | null => {
    if (value === undefined) return null;
    if (!requireSar(currency, "supplied_aggregate", `aggregate:${path}`, q, `${path}.currency`)) return null;
    const n = parseMoneyToCents(value);
    if (n === null) issue(q, "supplied_aggregate", `aggregate:${path}`, path, "invalid_nonnegative_money");
    else metrics[key] = n;
    return n;
  };
  if (!PANEL_NAMES[panel]) { q.unsupported_rows++; limitations.push("القسم المطلوب غير مدعوم؛ لم تُنشأ له توصيات تخصصية."); }
  const orgTotals = object(context.org_totals);
  const summary = options.summary;
  const donationCount = summary ? summary.totals.donations : count("donations_count", orgTotals.donations_count !== undefined ? orgTotals.donations_count : context.total_donations_count, "org_totals.donations_count");
  const amount = summary ? summary.totals.donations_amount_cents : money("donations_total_cents", orgTotals.donations_total !== undefined ? orgTotals.donations_total : context.total_donations_amount, "org_totals.donations_total", orgTotals.currency !== undefined ? orgTotals.currency : declaredCurrency);
  const donors = summary ? summary.totals.observed_donors : count("donors_count", orgTotals.donors_count, "org_totals.donors_count");
  if (donationCount !== null) metrics.donations_count = donationCount;
  if (amount !== null) metrics.donations_total_cents = amount;
  if (donors !== null) metrics.donors_count = donors;
  if (donationCount !== null || amount !== null) {
    const average = donationCount !== null && donationCount > 0 && amount !== null ? Math.round(amount / donationCount) : null;
    metrics.average_donation_cents = average;
    const proof = makeProof("org_totals", { donations_count: donationCount, donations_total_cents: amount, average_donation_cents: average });
    segments.push({ title: "حجم العطاء المسجل", description: `${donationCount === null ? "عدد التبرعات غير متاح" : `عدد التبرعات ${donationCount}`}؛ ${amount === null ? "المبلغ غير متاح" : `المبلغ ${moneyText(amount)}`}. ${average === null ? "متوسط التبرع غير قابل للحساب دون مبلغ وعدد موجب." : `متوسط التبرع ${moneyText(average)}، مقرب إلى أقرب هللة.`}`, evidence: proof });
  }
  if (donors !== null && donationCount !== null) {
    metrics.donations_per_donor = donors > 0 ? Math.round(donationCount / donors * 100) / 100 : null;
    segments.push({ title: "كثافة التبرع في البيانات", description: `${donors} متبرع؛ عدد العمليات لكل متبرع ${metrics.donations_per_donor ?? "غير متاح لعدم وجود متبرعين"}. لا يمثل هذا نسبة الاحتفاظ.`, evidence: makeProof("org_totals", { donors_count: donors, donations_count: donationCount, donations_per_donor: metrics.donations_per_donor }) });
  }
  const recurring = summary ? summary.cohorts.repeat_donors : count("recurring_count", context.recurring_count);
  if (recurring !== null) {
    if (donors !== null && recurring > donors) issue(q, "supplied_aggregate", "aggregate:recurring_count", "recurring_count", "exceeds_donor_count");
    else {
      const share = donors === null ? null : percentage(recurring, donors);
      metrics.recurring_count = recurring; metrics.recurring_share_percent = share;
      const proof = makeProof("recurring_count", { recurring_count: recurring, donors_count: donors, share_percent: share });
      segments.push({ title: "المتبرعون المتكررون", description: `${recurring} متبرع لديه عمليتا تبرع أو أكثر في البيانات؛ نسبتهم ${percentText(share)}.`, evidence: proof });
      if (recurring > 0) retention.push({ title: "مراجعة تجربة المتبرعين المتكررين", description: "راجع انتظام الشكر وتقارير الأثر لهذه الشريحة، وسجل نتيجة المتابعة دون افتراض استجابة أو إيراد مستقبلي.", evidence: proof });
    }
  }
  const addCountSection = (key: string, value: unknown, label: string, action: string) => {
    const n = count(key, value);
    if (n === null) return;
    const proof = makeProof(key, { [key]: n });
    segments.push({ title: label, description: `العدد المسجل: ${n}.`, evidence: proof });
    if (n > 0) retention.push({ title: `مراجعة ${label}`, description: action, evidence: proof });
  };
  addCountSection("subs_count", context.subs_count, "الاستقطاعات", "راجع حالات الاستقطاعات ومواعيد التحصيل، ولا تعتبر تاريخاً قديماً دليلاً كافياً على فشل الدفع.");
  addCountSection("campaigns_count", context.campaigns_count, "الحملات", "راجع المحصل والهدف وتاريخ النهاية لكل حملة قبل تحديد ما يحتاج متابعة.");
  addCountSection("gifts_count", context.gifts_count, "الإهداءات", "راجع اكتمال بيانات الإهداءات وتوثيق شكر المهدين وفق تفضيلات التواصل.");
  addCountSection("failed_count", context.failed_count, "محاولات التبرع الفاشلة", "راجع سبب الفشل وحالة إعادة المحاولة؛ لا تجمع المحاولات الفاشلة مع الإيراد المحصل.");
  addCountSection("abandoned_count", context.abandoned_count, "السلال المتروكة", "تحقق من عدم إتمام التبرع لاحقاً ومن صلاحية التواصل قبل إعداد متابعة.");
  const abandonedAmount = money("abandoned_value_cents", context.abandoned_value);
  if (abandonedAmount !== null) segments.push({ title: "قيمة السلال المسجلة", description: `${moneyText(abandonedAmount)} قيمة سلال، وليست تبرعات محصلة أو إيراداً مضموناً.`, evidence: makeProof("abandoned_value", { amount_cents: abandonedAmount }) });
  const elite = count("elite_count", context.elite_count);
  if (elite !== null) segments.push({ title: "متعددو الأنشطة", description: `${elite} متبرع ضمن شريحة النخبة حسب التعريف المرسل. تعدد الأنشطة لا يثبت ارتفاع قيمة العطاء أو الاحتفاظ.`, evidence: makeProof("elite_count", { elite_count: elite }) });
  for (const [key, label] of [["donors_segments", "شريحة المتبرعين"], ["by_method", "وسيلة الدفع"], ["by_status", "حالة التبرع"], ["subs_by_status", "حالة الاستقطاع"], ["campaigns_by_status", "حالة الحملة"], ["failed_by_status", "حالة إعادة المحاولة"], ["tiers", "تصنيف النخبة"]]) {
    const values = Object.entries(object(context[key])).sort(([a], [b]) => a.localeCompare(b));
    const parsed: { name: string; count: number }[] = [];
    for (const [name, value] of values) {
      const n = count(`${key}.${name}`, value, `${key}.${name}`);
      if (n !== null) parsed.push({ name, count: n });
    }
    const total = parsed.reduce((sum, row) => addCents(sum, row.count), 0);
    for (const row of parsed) {
      const proof = makeProof(`${key}.${row.name}`, { count: row.count, valid_category_total: total, share_percent: percentage(row.count, total) });
      segments.push({ title: `${label}: ${row.name}`, description: `${row.count} من ${total} في التصنيفات الصالحة المرسلة (${percentText(percentage(row.count, total))}).`, evidence: proof });
      if (key === "tiers" && row.count > 0) tierActions.push({ title: row.name, description: `راجع ${row.count} ملفاً في هذا التصنيف وحدّث سجل الأنشطة والمتابعة. التصنيف وحده لا يثبت القدرة المالية أو احتمال التبرع.`, evidence: proof });
    }
  }
  const topProjects = summary ? summary.top_projects.map(row => ({ project: row.project, total: row.amount_cents / 100, currency: "SAR" })) : Array.isArray(context.top_projects) ? context.top_projects : [];
  for (const value of topProjects.slice(0, 8)) {
    const row = object(value), name = text(row.project ?? row.name);
    if (!name) { issue(q, "supplied_aggregate", null, "top_projects", "missing_project_name"); continue; }
    const cents = money(`project:${name}:cents`, row.total, `top_projects.${name}.total`, row.currency !== undefined ? row.currency : declaredCurrency);
    const projectCount = count(`project:${name}:count`, row.count, `top_projects.${name}.count`);
    if (cents === null && projectCount === null) continue;
    const proof = makeProof(`top_projects.${name}`, { amount_cents: cents, count: projectCount });
    segments.push({ title: `المشروع: ${name}`, description: `${cents !== null ? `المبلغ المسجل ${moneyText(cents)}.` : `عدد الارتباطات بالمشروع ${projectCount}.`} القائمة المعروضة لا تثبت سبب تفضيل المشروع.`, evidence: proof });
    if (campaigns.length === 0 && (cents ?? projectCount ?? 0) > 0) campaigns.push({ title: `قالب تحديث أثر: ${name}`, description: "اجمع أرقام الإنجاز المثبتة لهذا المشروع، وراجعها ثم أعد تحديثاً يوضح أين صرف العطاء. لا تنشر أرقام مستفيدين أو أثر غير موثقة.", evidence: proof, template: true });
  }
  const major = summary?.cohorts.major_retention;
  const aggregateMajor = object(context.major_donor_retention);
  if (major && major.previous_donors > 0) {
    const description = `ظهر عطاء جديد لـ ${major.retained_donors} من ${major.previous_donors} من كبار متبرعي الفترة السابقة (${percentText(major.retention_percent)}). الفترتان: ${major.previous_period.from} إلى ${major.previous_period.to}، و${major.current_period.from} إلى ${major.current_period.to}. الحد ${moneyText(major.threshold_cents)} في الفترة السابقة.`;
    metrics.major_donor_retention_percent = major.retention_percent;
    retention.push({ title: "مراجعة استمرار عطاء كبار المتبرعين", description, evidence: major.evidence }); proofs.push(major.evidence);
  } else if (Object.keys(aggregateMajor).length) {
    const previous = count("major_previous_count", aggregateMajor.previous_count, "major_donor_retention.previous_count");
    const retained = count("major_retained_count", aggregateMajor.retained_count, "major_donor_retention.retained_count");
    if (previous !== null && retained !== null) {
      if (retained > previous) issue(q, "supplied_aggregate", null, "major_donor_retention.retained_count", "exceeds_previous_cohort");
      else {
        metrics.major_donor_retention_percent = percentage(retained, previous);
        const proof = makeProof("major_donor_retention", { previous_count: previous, retained_count: retained, retention_percent: metrics.major_donor_retention_percent });
        retention.push({ title: "استمرار العطاء حسب المجموعة المرسلة", description: `${retained} من ${previous} (${percentText(metrics.major_donor_retention_percent)}). يلزم التحقق من تعريف المجموعة والفترتين واكتمال المصدر قبل اعتماد المعدل.`, evidence: proof });
      }
    }
  }
  if ((donationCount ?? 0) > 0) drafts.push({ title: "قالب شكر للمراجعة قبل الإرسال", description: "شكراً لدعمكم. يسعدنا مشاركتكم تحديثاً موثقاً عن المشروع الذي دعمتموه بعد استكمال مراجعته. نقدّر عطاءكم ونتطلع إلى إبقائكم على اطلاع.", template: true });
  if (q.missing_currency_rows || q.unsupported_currency_rows) limitations.push(`استُبعدت ${q.missing_currency_rows} قيمة أو سجل بعملة مفقودة، و${q.unsupported_currency_rows} بعملة غير مدعومة؛ لا تُفترض العملة ولا يُجرى تحويل عملات.`);
  if (q.invalid_values) limitations.push(`استُبعدت ${q.invalid_values} قيمة غير صالحة؛ راجع تفاصيل جودة البيانات.`);
  if (!segments.length) limitations.push("لا توجد مقاييس مدعومة وكافية لإنتاج تحليل رقمي لهذا الطلب.");
  const executiveSummary = `تحليل بقواعد ثابتة لقسم ${PANEL_NAMES[panel] ?? "غير مدعوم"}. ${segments[0]?.description ?? "لا تتوفر أرقام صالحة كافية للتحليل."} ${summary ? "يعتمد على السجلات المقيدة بالجمعية." : "يعتمد على الملخص المرسل فقط."} التوصيات قوالب للمراجعة وليست توقعات للعائد أو لسلوك المتبرعين.`;
  return { source: RULES_SOURCE, organization_id: org, panel, period, analysis_date: analysisDate, executive_summary: executiveSummary, segments, retention_ideas: retention, creative_campaigns: campaigns, content_drafts: drafts, tier_actions: tierActions, metrics, evidence: proofs, quality: q, limitations };
}

/** Daily JSON schema is retained, with rule/evidence metadata for auditability and idempotent persistence. */
export function generateDailyDonorReport(summary: DonorSummary) {
  const current = summary.comparisons.today, previous = summary.comparisons.yesterday;
  const insights = summary.findings.map(finding => ({ ...finding, source: RULES_SOURCE }));
  const actionable = insights.filter(finding => finding.category !== "performance" && finding.recommended_actions.length > 0);
  const suggestedTasks = actionable.slice(0, 30).map(finding => ({
    title: finding.title.slice(0, 80), description: `${finding.summary}\n${finding.recommended_actions.join("\n")}`,
    category: "متابعة", priority: finding.severity === "high" ? "high" as const : "medium" as const,
    due_in_days: 1, ...(finding.donor_ref ? { donor_ref: finding.donor_ref } : {}),
    rule_id: finding.rule_id, source: RULES_SOURCE, evidence: finding.evidence,
  }));
  return {
    source: RULES_SOURCE, organization_id: summary.organization_id, report_date: summary.today,
    daily_brief: `سجلت البيانات الصالحة بالريال السعودي ${current.count} تبرعاً ناجحاً بتاريخ ${summary.today} بقيمة ${moneyText(current.amount_cents)}، مقابل ${previous.count} بقيمة ${moneyText(previous.amount_cents)} بتاريخ ${previous.period.from}. قد يكون اليوم الجاري غير مكتمل. مقارنة آخر 30 يوماً بالفترة السابقة: ${percentText(summary.comparisons.change_30_days_percent)}. عدد القواعد المطابقة ${insights.length}؛ القيم غير الصالحة ${summary.quality.invalid_values}، والصفوف غير المدعومة ${summary.quality.unsupported_rows}.`,
    kpi_highlights: [
      { label: "تبرعات اليوم المسجلة", value: String(current.count), hint: "العمليات ذات عملة سعودية معلنة وحالة نجاح صريحة وتاريخ صالح؛ اليوم الجاري قد لا يكون مكتملاً", evidence: current.evidence },
      { label: "مبلغ اليوم المسجل", value: moneyText(current.amount_cents), hint: "جمع بوحدات الهللة؛ لا يشمل المحاولات الفاشلة والسلال", evidence: current.evidence },
      { label: "مبلغ أمس المسجل", value: moneyText(previous.amount_cents), hint: previous.period.from, evidence: previous.evidence },
      { label: "تغير آخر 30 يوماً", value: percentText(summary.comparisons.change_30_days_percent), hint: "فترتان متتاليتان متساويتان؛ التغير لا يفسر السبب", evidence: summary.comparisons.current_30_days.evidence },
      { label: "استمرار عطاء كبار المتبرعين", value: percentText(summary.cohorts.major_retention.retention_percent), hint: "أي عطاء موجب في الفترة الحالية من مجموعة الفترة السابقة؛ ليس توقعاً", evidence: summary.cohorts.major_retention.evidence },
    ],
    insights, suggested_tasks: suggestedTasks, creative_ideas: [] as InsightSection[],
    quality: summary.quality, evidence: summary.evidence, limitations: summary.limitations,
  };
}
