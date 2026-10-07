/**
 * Deterministic, side-effect-free planning previews. No database, network, clock,
 * model, notification, inferred budget, or automatic assignment is used here.
 * Dates are local calendar dates in the configured IANA time zone.
 */
export const PLAN_RULE_VERSION = 'plan-rules-v1';
export type PlanRow = Record<string, unknown>;
export type ReviewItem = { code: string; message: string; source_plan_id?: string; source_row?: number; field?: string };
export type NormalizedPlanRow = PlanRow & { source_row: number; provenance: PlanRow };
export type WorkCalendar = { timezone?: string; weekend_days?: number[]; excluded_dates?: string[] };
export type SourcePlan = {
  id: string;
  organization_id: string;
  year: number;
  activity_name: string;
  activity_type?: string | null;
  annual_target?: number | null;
  responsible_employee_id?: string | null;
  responsible_employee?: string | { id?: string; full_name?: string } | null;
  strategic_goal?: string | null;
  estimated_budget?: number | null;
  status?: string | null;
  months?: { id?: string; month: number; monthly_target: number }[];
};
export type ExistingTask = {
  organization_id: string;
  id?: string;
  dedupe_key?: string | null;
  status?: string | null;
  completed_at?: string | null;
  source_activity_id?: string | null;
  operational_plan_id?: string | null;
  executive_plan_id?: string | null;
  due_date?: string | null;
  phase?: string | null;
  template_id?: string | null;
  metadata?: PlanRow | null;
};
export type DailyPlan = {
  id: string;
  organization_id: string;
  operational_plan_id: string;
  operational_plan_month_id: string | null;
  activity_name: string;
  activity_type: string;
  strategic_goal: string | null;
  responsible_employee_id: string;
  year: number;
  month: number;
  day: number;
  date: string;
  daily_target: number;
  status: 'preview';
  evidence: PlanRow;
};
export type PreviewTask = {
  id: string;
  dedupe_key: string;
  organization_id: string;
  operational_plan_id: string;
  source_activity_id: string | null;
  executive_plan_id: string | null;
  assigned_employee_id: string;
  title: string;
  description: string;
  due_date: string;
  phase: 'before' | 'during' | 'after';
  target: number | null;
  template_id: string;
  status: 'preview';
  source: 'rules_preview';
  ai_generated: false;
  metadata: PlanRow;
};

export class PlanRuleError extends Error {
  code: string;
  status = 422;
  constructor(code: string, message: string) { super(message); this.name = 'PlanRuleError'; this.code = code; }
}

function fail(code: string, message: string): never { throw new PlanRuleError(code, message); }
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function hasValue(value: unknown): boolean { return value !== null && value !== undefined && value !== ''; }
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function yearValid(value: unknown): value is number { return integer(value) && value >= 1900 && value <= 9999; }
function monthValid(value: unknown): value is number { return integer(value) && value >= 1 && value <= 12; }
function object(value: unknown): value is PlanRow { return !!value && typeof value === 'object' && !Array.isArray(value); }
function scope(organizationId: string, rows: { organization_id: string }[]): void {
  if (!text(organizationId) || !Array.isArray(rows) || rows.some(row => !row || row.organization_id !== organizationId)) {
    fail('organization_scope_mismatch', 'لا تتطابق البيانات مع الجمعية المطلوبة.');
  }
}

/** Exact aliases only. Normalization never turns free text into an instruction. */
export function normalizePlanColumn(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا')
    .replace(/[\s_\-:()]+/g, ' ').trim();
}
const FIELD_ALIASES: Record<string, readonly string[]> = {
  activity_name: ['activity_name', 'activity', 'activity name', 'النشاط', 'اسم النشاط', 'الانشطة', 'الأنشطة'],
  activity_type: ['activity_type', 'activity type', 'نوع النشاط'],
  strategic_goal: ['strategic_goal', 'strategic goal', 'goal', 'الهدف', 'الهدف الاستراتيجي'],
  initiative: ['initiative', 'المبادرة', 'اسم المبادرة', 'المبادرة الرئيسية'],
  sub_initiative: ['sub_initiative', 'sub initiative', 'المبادرة الفرعية'],
  annual_target: ['annual_target', 'annual target', 'المستهدف السنوي', 'الهدف السنوي'],
  estimated_budget: ['estimated_budget', 'estimated budget', 'budget', 'الميزانية', 'الميزانية التقديرية', 'التكلفة التقديرية', 'التكلفة التقديرية (ريال)'],
  responsible_employee_id: ['responsible_employee_id', 'responsible employee id', 'معرف مسؤول التنفيذ', 'معرف الموظف المسؤول'],
  responsible_employee: ['responsible_employee', 'responsible employee', 'مسؤول التنفيذ', 'الموظف المسؤول', 'المسؤول'],
};
const COLUMN_FIELDS = new Map(Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => aliases.map(alias => [normalizePlanColumn(alias), field])));

/** Kept deliberately narrow: unknown activity names require a person's review. */
export const ACTIVITY_TEMPLATES = [
  { id: 'content_publication', names: ['نشر محتوى', 'نشر المحتوى', 'نشر منشورات', 'نشر منشور', 'content publication', 'publish content'] },
  { id: 'content_design', names: ['تصميم محتوى', 'تصميم المحتوى', 'تصميم منشورات', 'تصميم منشور', 'content design'] },
  { id: 'report_preparation', names: ['إعداد تقرير', 'اعداد تقرير', 'إعداد التقارير', 'اعداد التقارير', 'report preparation'] },
  { id: 'donor_contact', names: ['التواصل مع المتبرعين', 'تواصل مع المتبرعين', 'donor contact'] },
  { id: 'event_delivery', names: ['تنفيذ فعالية', 'تنفيذ الفعاليات', 'event delivery'] },
] as const;
function templateFor(plan: Pick<SourcePlan, 'activity_name' | 'activity_type'>): string | null {
  const explicit = text(plan.activity_type);
  if (explicit) return ACTIVITY_TEMPLATES.find(t => t.id === explicit)?.id ?? null;
  const normalized = normalizePlanColumn(text(plan.activity_name));
  return ACTIVITY_TEMPLATES.find(t => t.names.some(name => normalizePlanColumn(name) === normalized))?.id ?? null;
}
function responsible(plan: Pick<SourcePlan, 'responsible_employee_id' | 'responsible_employee'>): string {
  const explicit = text(plan.responsible_employee_id);
  const joined = object(plan.responsible_employee) ? text(plan.responsible_employee.id) : '';
  if (explicit && joined && explicit !== joined) return '';
  if (explicit) return explicit;
  if (joined) return joined;
  // A free-text name must first be resolved and explicitly approved as an employee ID.
  return '';
}
function completed(status: unknown): boolean { return ['completed', 'done', 'مكتمل', 'مكتملة'].includes(text(status).toLowerCase()); }
function previewBase(organizationId: string) {
  return { mode: 'rules' as const, preview_only: true as const, requires_confirmation: true as const,
    organization_id: organizationId, rule_version: PLAN_RULE_VERSION, generated_by: 'deterministic_rules' as const,
    writes_performed: 0 as const, notifications_sent: 0 as const };
}

/** Nonnegative integer weights; exact BigInt remainders avoid floating-point drift. */
export function allocateLargestRemainder(total: number, weights: readonly number[]): number[] {
  if (!integer(total) || weights.some(weight => !integer(weight))) fail('invalid_allocation', 'المستهدف والأوزان يجب أن تكون أعداداً صحيحة غير سالبة.');
  const sum = weights.reduce((acc, value) => acc + BigInt(value), 0n);
  if (sum === 0n) {
    if (total !== 0) fail('no_allocation_capacity', 'لا توجد أيام عمل لتوزيع المستهدف.');
    return weights.map(() => 0);
  }
  const parts = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight);
    return { index, floor: Number(numerator / sum), remainder: numerator % sum };
  });
  const result = parts.map(part => part.floor);
  let remaining = total - result.reduce((sum, amount) => sum + amount, 0);
  parts.sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of parts) { if (!remaining) break; result[part.index]++; remaining--; }
  return result;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function calendarConfig(calendar: WorkCalendar = {}) {
  if (!object(calendar) || (calendar.weekend_days !== undefined && !Array.isArray(calendar.weekend_days)) || (calendar.excluded_dates !== undefined && !Array.isArray(calendar.excluded_dates))) fail('invalid_calendar', 'إعدادات أيام العمل غير صالحة.');
  const timezone = calendar.timezone ?? 'Asia/Riyadh';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0); }
  catch { fail('invalid_timezone', 'المنطقة الزمنية غير صالحة.'); }
  const weekend_days = [...new Set(calendar.weekend_days ?? [5, 6])].sort();
  if (weekend_days.some(day => !integer(day) || day > 6)) fail('invalid_weekend', 'أيام نهاية الأسبوع يجب أن تكون من 0 إلى 6.');
  const excluded_dates = [...new Set(calendar.excluded_dates ?? [])].sort();
  if (excluded_dates.some(date => !validDate(date))) fail('invalid_calendar_date', 'تاريخ الاستثناء غير صالح.');
  return { timezone, weekend_days, excluded_dates };
}
/** An instant must include an offset; date-only values already represent local dates. */
export function dateInTimeZone(value: string, calendar: WorkCalendar = {}): string {
  const config = calendarConfig(calendar);
  if (validDate(value)) return value;
  if (typeof value !== 'string' || !/[Tt].*(?:[Zz]|[+-]\d{2}:\d{2})$/.test(value)) fail('ambiguous_date', 'يلزم تاريخ محلي أو وقت يتضمن المنطقة الزمنية.');
  if (!/^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !validDate(value.slice(0, 10))) fail('invalid_date', 'التاريخ غير صالح.');
  const instant = new Date(value);
  if (!Number.isFinite(instant.valueOf())) fail('invalid_date', 'التاريخ غير صالح.');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function workingDates(year: number, month: number, calendar: WorkCalendar = {}): string[] {
  if (!yearValid(year) || !monthValid(month)) fail('invalid_period', 'السنة أو الشهر غير صالح.');
  const config = calendarConfig(calendar);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: string[] = [];
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const iso = date.toISOString().slice(0, 10);
    if (!config.weekend_days.includes(date.getUTCDay()) && !config.excluded_dates.includes(iso)) result.push(iso);
  }
  return result;
}

/** A preview identity, deliberately not a database UUID. Encoding is collision-free. */
export function deterministicPreviewId(organizationId: string, planId: string, date: string, templateId: string, version = PLAN_RULE_VERSION): string {
  const fields = [organizationId, planId, date, templateId, version];
  if (fields.some(field => !text(field))) fail('invalid_identity', 'هوية المعاينة غير مكتملة.');
  return `rule-preview:${fields.map(encodeURIComponent).join(':')}`;
}

function numericCell(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[٠-٩۰-۹]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.includes(digit) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/٫/g, '.').replace(/٬/g, ',');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) return null;
  const result = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(result) && result <= Number.MAX_SAFE_INTEGER ? result : null;
}

export function previewExcelPlan(input: {
  organization_id: string; plan_name: string; year: number; columns: string[]; rows: PlanRow[]; source_filename?: string;
}) {
  scope(input.organization_id, []);
  if (!yearValid(input.year) || !text(input.plan_name) || !Array.isArray(input.columns) || input.columns.some(column => typeof column !== 'string') || !Array.isArray(input.rows) || input.rows.some(row => !object(row))) {
    fail('invalid_excel_input', 'بيانات ملف الخطة غير صالحة.');
  }
  const needs_review: ReviewItem[] = [];
  if (!input.rows.length) needs_review.push({ code: 'missing_source_rows', message: 'لا توجد صفوف مصدر لبناء الخطة.' });
  const fieldColumns = new Map<string, string[]>();
  for (const column of input.columns) {
    const field = COLUMN_FIELDS.get(normalizePlanColumn(column));
    if (field) fieldColumns.set(field, [...(fieldColumns.get(field) ?? []), column]);
  }
  const column_mapping = Object.fromEntries([...fieldColumns].map(([field, columns]) => [field, columns.length === 1 ? columns[0] : null]));
  for (const [field, columns] of fieldColumns) if (columns.length > 1) needs_review.push({ code: 'ambiguous_column', field, message: `أكثر من عمود يطابق الحقل ${field}. اختر العمود يدوياً.` });
  const normalized_rows: NormalizedPlanRow[] = input.rows.map((row, index) => {
    const values: PlanRow = {};
    const provenance: PlanRow = {};
    const add = (code: string, field: string, message: string) => needs_review.push({ code, field, message, source_row: index + 1 });
    for (const [field, column] of Object.entries(column_mapping)) {
      if (!column || !Object.hasOwn(row, column) || !hasValue(row[column])) continue;
      provenance[field] = { source_column: column, original_value: structuredClone(row[column]) };
      if (field === 'annual_target' || field === 'estimated_budget') {
        const number = numericCell(row[column]);
        if (number === null || (field === 'annual_target' && !integer(number))) add('invalid_numeric_value', field, 'القيمة الرقمية تحتاج مراجعة ولم يتم تقدير بديل.');
        else values[field] = number;
      } else if (typeof row[column] === 'string' && text(row[column])) values[field] = text(row[column]);
      else add('invalid_text_value', field, 'يلزم نص صريح لهذا الحقل.');
    }
    if (!values.activity_name) add('missing_activity', 'activity_name', 'لا يوجد نشاط صريح في الصف.');
    else if (!templateFor(values as SourcePlan)) add('unknown_activity', 'activity_name', 'لا يطابق النشاط قالباً معتمداً؛ يلزم اختيار قالب أو المراجعة اليدوية.');
    if (values.annual_target === undefined) add('missing_target', 'annual_target', 'لا يوجد مستهدف سنوي صحيح؛ لم يتم اختراع مستهدف.');
    if (!values.responsible_employee_id) add('missing_responsibility', 'responsible_employee_id', 'يلزم تحديد معرف مسؤول التنفيذ صراحة؛ الاسم الحر لا يكفي للإسناد.');
    return { source_row: index + 1, ...values, provenance };
  });
  return { ...previewBase(input.organization_id), plan_name: input.plan_name, year: input.year,
    source_filename: input.source_filename ?? null, columns: structuredClone(input.columns), rows: structuredClone(input.rows),
    column_mapping, normalized_rows, needs_review, inferred_goal: null,
    evidence: { source: 'provided_excel_rows', source_rows: input.rows.length, original_rows_preserved: true, normalization: 'exact_column_aliases_only' } };
}

export type PlanPreviewInput = {
  organization_id: string; year: number; months: number[]; plans: SourcePlan[]; calendar?: WorkCalendar;
};
export function previewExecutivePlans(input: PlanPreviewInput) {
  if (!Array.isArray(input.plans) || !Array.isArray(input.months) || !yearValid(input.year) || !input.months.length || input.months.some(month => !monthValid(month))) fail('invalid_period', 'يلزم تحديد سنة وأشهر صالحة.');
  if (input.plans.length > 200) fail('preview_limit', 'تتجاوز المعاينة 200 خطة مصدر. اختر مجموعة أصغر.');
  scope(input.organization_id, input.plans);
  const calendar = calendarConfig(input.calendar);
  const selectedMonths = [...new Set(input.months)].sort((a, b) => a - b);
  const needs_review: ReviewItem[] = [];
  if (!input.plans.length) needs_review.push({ code: 'missing_source_plans', message: 'لا توجد خطط مصدر لإنشاء المعاينة.' });
  const plans: DailyPlan[] = [];
  const monthly_allocations: { source_plan_id: string; year: number; month: number; monthly_target: number; selected: boolean; origin: string }[] = [];
  const skipped: { source_plan_id: string; reason: string }[] = [];
  const seen = new Set<string>();
  const signatures = new Map<string, Set<string>>();
  for (const source of input.plans) {
    const signature = JSON.stringify([source.year, source.activity_name, source.activity_type, source.annual_target,
      source.responsible_employee_id, source.responsible_employee, source.strategic_goal, source.status, source.months]);
    const values = signatures.get(source.id) ?? new Set<string>();
    values.add(signature);
    signatures.set(source.id, values);
  }
  for (const source of input.plans) {
    if ((signatures.get(source.id)?.size ?? 0) > 1) {
      if (!seen.has(source.id)) needs_review.push({ source_plan_id: source.id, code: 'conflicting_source_plan', message: 'توجد نسخ متعارضة لمعرف الخطة نفسه؛ لم يتم اختيار نسخة تلقائياً.' });
      seen.add(source.id);
      continue;
    }
    const issues: ReviewItem[] = [];
    const review = (code: string, message: string, field?: string) => issues.push({ code, message, field, source_plan_id: source.id });
    if (!text(source.id)) review('missing_plan_id', 'معرف الخطة المصدر مطلوب.');
    else if (seen.has(source.id)) { skipped.push({ source_plan_id: source.id, reason: 'duplicate_source_plan' }); continue; }
    seen.add(source.id);
    if (completed(source.status)) { skipped.push({ source_plan_id: source.id, reason: 'completed_plan' }); continue; }
    if (source.year !== input.year) review('source_year_mismatch', 'سنة المصدر لا تطابق السنة المطلوبة.', 'year');
    if (!text(source.activity_name)) review('missing_activity', 'اسم النشاط المصدر مطلوب.', 'activity_name');
    const template = templateFor(source);
    if (!template) review('unknown_activity', 'النشاط غير معروف للقوالب؛ يلزم مراجعة بشرية.', 'activity_name');
    const employee = responsible(source);
    if (!employee) review('missing_responsibility', 'حدد مسؤول التنفيذ صراحة قبل توليد المهام.', 'responsible_employee_id');
    const suppliedAnnual = hasValue(source.annual_target);
    if (suppliedAnnual && !integer(source.annual_target)) review('invalid_target', 'المستهدف السنوي يجب أن يكون عدداً صحيحاً غير سالب.', 'annual_target');
    const providedMonths = source.months ?? [];
    if (!Array.isArray(providedMonths)) { review('invalid_monthly_targets', 'المستهدفات الشهرية غير صالحة.', 'months'); needs_review.push(...issues); continue; }
    const monthTargets = new Map<number, { target: number; id: string | null; origin: string }>();
    for (const month of providedMonths) {
      if (!month || !monthValid(month.month) || !integer(month.monthly_target) || monthTargets.has(month.month)) {
        review('invalid_monthly_targets', 'شهر مكرر أو مستهدف شهري غير صحيح؛ لم يتم توزيع الخطة.', 'months'); continue;
      }
      monthTargets.set(month.month, { target: month.monthly_target, id: text(month.id) || null, origin: 'explicit_monthly_target' });
    }
    if (!providedMonths.length) {
      if (!integer(source.annual_target)) review('missing_target', 'لا توجد مستهدفات صحيحة في المصدر.', 'annual_target');
      else {
        // Annual targets always use all 12 months. Selecting one month cannot multiply an annual target.
        const annualDates = Array.from({ length: 12 }, (_, index) => workingDates(input.year, index + 1, calendar));
        if (source.annual_target > 0 && annualDates.every(dates => dates.length === 0)) review('no_working_days', 'لا توجد أيام عمل لتوزيع المستهدف.');
        else allocateLargestRemainder(source.annual_target, annualDates.map(dates => dates.length)).forEach((target, index) => monthTargets.set(index + 1, { target, id: null, origin: 'annual_target_largest_remainder_by_workdays' }));
      }
    } else if (integer(source.annual_target)) {
      const monthlyTotal = [...monthTargets.values()].reduce((total, month) => total + month.target, 0);
      if (monthlyTotal > source.annual_target || (monthTargets.size === 12 && monthlyTotal !== source.annual_target)) review('target_mismatch', 'المستهدفات الشهرية لا تتفق مع المستهدف السنوي؛ يلزم المراجعة.', 'months');
    }
    for (const month of selectedMonths) {
      const target = monthTargets.get(month);
      if (!target) review('missing_monthly_target', `لا يوجد مستهدف صريح للشهر ${month}؛ لم يتم اختراع مستهدف.`, 'months');
      else if (target.target > 0 && !workingDates(input.year, month, calendar).length) review('no_working_days', `لا توجد أيام عمل في الشهر ${month}.`);
    }
    needs_review.push(...issues);
    if (issues.length) continue;
    for (const [month, target] of [...monthTargets].sort(([a], [b]) => a - b)) {
      monthly_allocations.push({ source_plan_id: source.id, year: input.year, month, monthly_target: target.target, selected: selectedMonths.includes(month), origin: target.origin });
      if (!selectedMonths.includes(month)) continue;
      const dates = workingDates(input.year, month, calendar);
      const daily = allocateLargestRemainder(target.target, dates.map(() => 1));
      if (plans.length + daily.filter(target => target > 0).length > 5000) fail('preview_limit', 'تتجاوز المعاينة 5000 صف يومي. اختر فترة أو مجموعة أصغر.');
      dates.forEach((date, index) => {
        if (daily[index] === 0) return;
        plans.push({ id: deterministicPreviewId(input.organization_id, source.id, date, `${template}:daily`),
          organization_id: input.organization_id, operational_plan_id: source.id, operational_plan_month_id: target.id,
          activity_name: source.activity_name, activity_type: template!, strategic_goal: text(source.strategic_goal) || null,
          responsible_employee_id: employee, year: input.year, month, day: Number(date.slice(-2)), date,
          daily_target: daily[index], status: 'preview', evidence: { source_plan_id: source.id, source_month_id: target.id,
            annual_target: source.annual_target ?? null, monthly_target: target.target, allocation: target.origin,
            daily_allocation: 'largest_remainder_equal_workdays', rule_version: PLAN_RULE_VERSION } });
      });
    }
  }
  return { ...previewBase(input.organization_id), year: input.year, months: selectedMonths, calendar, plans, monthly_allocations, needs_review, skipped,
    evidence: { source: 'explicit_operational_plans', source_plan_ids: input.plans.map(plan => plan.id),
      annual_distribution_period: 'all_12_months', selected_months: selectedMonths,
      tie_break: 'earliest_month_then_earliest_working_date', holidays: 'only_explicit_excluded_dates' } };
}

type TaskPreviewInput = PlanPreviewInput & { existing_tasks?: ExistingTask[] };
function priorTaskKeys(organizationId: string, existing: ExistingTask[], calendar: WorkCalendar) {
  scope(organizationId, existing);
  const exact = new Set<string>();
  const covered = new Set<string>();
  const executive = new Set<string>();
  for (const task of existing) {
    if (text(task.id)) exact.add(task.id!);
    if (text(task.dedupe_key)) exact.add(task.dedupe_key!);
    const executiveId = text(task.executive_plan_id) || text(task.source_activity_id);
    if (executiveId) executive.add(JSON.stringify([executiveId, text(task.phase) || '*']));
    const planId = text(task.operational_plan_id) || text(task.metadata?.source_plan_id);
    if (!planId || !text(task.due_date)) continue;
    // Invalid existing task dates cannot safely establish deduplication.
    const date = dateInTimeZone(task.due_date!, calendar);
    const template = text(task.template_id) || text(task.metadata?.template_id);
    covered.add(JSON.stringify([planId, date, template || '*']));
  }
  return { exact, covered, executive };
}
function taskFromDaily(daily: DailyPlan, phase: PreviewTask['phase'], executivePlanId: string | null): PreviewTask {
  const template = `${daily.activity_type}:${phase}`;
  const id = deterministicPreviewId(daily.organization_id, daily.operational_plan_id, daily.date, template);
  const verb = phase === 'before' ? 'تجهيز' : phase === 'after' ? 'توثيق تنفيذ' : 'تنفيذ';
  return { id, dedupe_key: id, organization_id: daily.organization_id, operational_plan_id: daily.operational_plan_id, source_activity_id: executivePlanId,
    executive_plan_id: executivePlanId, assigned_employee_id: daily.responsible_employee_id,
    title: `${verb}: ${daily.activity_name}`, description: phase === 'during' ? `${daily.activity_name}؛ المستهدف المعتمد لهذا اليوم: ${daily.daily_target}.` : `${verb} النشاط الوارد في الخطة: ${daily.activity_name}.`,
    due_date: daily.date, phase, target: phase === 'during' ? daily.daily_target : null, template_id: template,
    status: 'preview', source: 'rules_preview', ai_generated: false,
    metadata: { source_plan_id: daily.operational_plan_id, source_month_id: daily.operational_plan_month_id,
      template_id: template, rule_version: PLAN_RULE_VERSION, evidence: structuredClone(daily.evidence),
      assignment_source: 'explicit_responsible_employee', no_quality_assessment: true } };
}
function deduplicate(tasks: PreviewTask[], existing: ExistingTask[], organizationId: string, calendar: WorkCalendar) {
  const keys = priorTaskKeys(organizationId, existing, calendar);
  const result: PreviewTask[] = [];
  const skipped: { id: string; source_plan_id: string; reason: string }[] = [];
  for (const task of tasks) {
    const scoped = JSON.stringify([task.operational_plan_id, task.due_date, task.template_id]);
    const broad = JSON.stringify([task.operational_plan_id, task.due_date, '*']);
    const executiveCovered = task.executive_plan_id && (keys.executive.has(JSON.stringify([task.executive_plan_id, task.phase])) || keys.executive.has(JSON.stringify([task.executive_plan_id, '*'])));
    if (keys.exact.has(task.id) || keys.covered.has(scoped) || keys.covered.has(broad) || executiveCovered) {
      skipped.push({ id: task.id, source_plan_id: task.operational_plan_id, reason: 'existing_or_completed_task' }); continue;
    }
    keys.exact.add(task.id);
    keys.covered.add(scoped);
    result.push(task);
  }
  return { tasks: result, skipped };
}
export function previewTasks(input: TaskPreviewInput) {
  const preview = previewExecutivePlans(input);
  const candidates = preview.plans.map(daily => taskFromDaily(daily, 'during', null));
  const tasks = deduplicate(candidates, input.existing_tasks ?? [], input.organization_id, preview.calendar);
  return { ...preview, tasks: tasks.tasks, skipped_tasks: tasks.skipped, total_preview_tasks: tasks.tasks.length };
}

/** Related phases stay on the explicitly scheduled working day, never arbitrary offsets. */
export function previewRelatedTasks(input: {
  organization_id: string;
  plan: SourcePlan & { executive_plan_id: string; date: string; daily_target: number; completed_at?: string | null };
  existing_tasks?: ExistingTask[];
  calendar?: WorkCalendar;
}) {
  scope(input.organization_id, [input.plan]);
  scope(input.organization_id, input.existing_tasks ?? []);
  const calendar = calendarConfig(input.calendar);
  const source = input.plan;
  const needs_review: ReviewItem[] = [];
  const base = { ...previewBase(input.organization_id), calendar, needs_review,
    evidence: { source_plan_id: source.id, executive_plan_id: source.executive_plan_id, rule_version: PLAN_RULE_VERSION } };
  if (completed(source.status) || source.completed_at) return { ...base, tasks: [] as PreviewTask[], skipped_tasks: [{ source_plan_id: source.id, reason: 'completed_plan' }] };
  const review = (code: string, message: string) => needs_review.push({ source_plan_id: source.id, code, message });
  if (!text(source.id) || !text(source.executive_plan_id)) review('missing_plan_id', 'يلزم معرف خطة المصدر ومعرف الخطة التنفيذية.');
  const template = templateFor(source);
  if (!text(source.activity_name)) review('missing_activity', 'اسم النشاط المصدر مطلوب.');
  if (!template) review('unknown_activity', 'النشاط غير معروف للقوالب؛ يلزم مراجعة بشرية.');
  const employee = responsible(source);
  if (!employee) review('missing_responsibility', 'حدد مسؤول التنفيذ صراحة.');
  if (!integer(source.daily_target)) review('invalid_target', 'المستهدف اليومي يجب أن يكون عدداً صحيحاً غير سالب.');
  const date = dateInTimeZone(source.date, calendar);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (source.year !== year) review('source_year_mismatch', 'سنة المصدر لا تطابق تاريخ التنفيذ.');
  if (!workingDates(year, month, calendar).includes(date)) review('non_working_date', 'تاريخ التنفيذ يقع خارج أيام العمل؛ لم يتم تغيير موعده تلقائياً.');
  if (needs_review.length || source.daily_target === 0) return { ...base, tasks: [] as PreviewTask[], skipped_tasks: [] };
  const daily: DailyPlan = { id: source.executive_plan_id, organization_id: input.organization_id,
    operational_plan_id: source.id, operational_plan_month_id: null, activity_name: source.activity_name, activity_type: template!,
    strategic_goal: text(source.strategic_goal) || null, responsible_employee_id: employee,
    year, month, day: Number(date.slice(-2)), date, daily_target: source.daily_target, status: 'preview',
    evidence: { source_plan_id: source.id, executive_plan_id: source.executive_plan_id, source_daily_target: source.daily_target } };
  const candidates = (['before', 'during', 'after'] as const).map(phase => taskFromDaily(daily, phase, source.executive_plan_id));
  const result = deduplicate(candidates, input.existing_tasks ?? [], input.organization_id, calendar);
  return { ...base, tasks: result.tasks, skipped_tasks: result.skipped };
}
