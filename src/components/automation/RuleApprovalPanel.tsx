import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

// This panel never submits preview rows. The server derives the reviewed tasks
// from one saved month, its recorded employee, and explicitly selected dates.
const uuid = z.string().uuid();
const count = z.number().int().nonnegative().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const selectionSchema = z.object({
  organization_id: uuid, source_plan_id: uuid, source_month_id: uuid,
  assigned_employee_id: uuid, task_dates: z.array(date).min(1).max(31),
}).strict();
const existingTaskSchema = z.object({
  id: uuid, status: z.string(), due_date: date.nullable(), dedupe_key: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(), phase: z.string().nullable(), executive_plan_id: uuid.nullable(),
  source_activity_id: uuid.nullable(), updated_at: z.string().nullable(), source: z.string().nullable(),
  assigned_employee_id: uuid.nullable(), user_id: uuid,
}).passthrough();
const taskSchema = z.object({
  dedupe_key: z.string().min(1), organization_id: uuid, assigned_employee_id: uuid, user_id: uuid,
  title: z.string().min(1), description: z.string(), due_date: date, phase: z.literal("during"),
  target: count.positive(), template_id: z.string().min(1), status: z.literal("upcoming"),
  priority: z.literal("medium"), source: z.literal("rules_approved"), ai_generated: z.literal(false),
  metadata: z.object({
    source_plan_id: uuid, source_month_id: uuid, template_id: z.string(), rule_version: z.literal("plan-rules-v1"),
    target: count.positive(), assignment_source: z.literal("explicit_responsible_employee"), no_quality_assessment: z.literal(true),
    evidence: z.object({ source_plan_id: uuid, source_month_id: uuid, annual_target: count, monthly_target: count,
      allocation: z.literal("explicit_monthly_target"), daily_allocation: z.literal("largest_remainder_equal_workdays"), rule_version: z.literal("plan-rules-v1") }).passthrough(),
  }).passthrough(),
}).passthrough();
const reviewSchema = z.object({
  contract: z.literal("rule-approved-month-v1"), user_id: uuid, selection: selectionSchema,
  calendar: z.object({ timezone: z.literal("Asia/Riyadh"), weekend_days: z.tuple([z.literal(5), z.literal(6)]), excluded_dates: z.array(date).max(0) }),
  source_plan: z.object({ id: uuid, organization_id: uuid, responsible_employee_id: uuid,
    activity_name: z.string().min(1), year: count.min(2000).max(2100), annual_target: count }).passthrough(),
  source_months: z.array(z.object({ id: uuid, organization_id: uuid, operational_plan_id: uuid,
    month: count.min(1).max(12), monthly_target: count }).passthrough()).min(1).max(12),
  employee: z.object({ id: uuid, organization_id: uuid, user_id: uuid, full_name: z.string().trim().min(1),
    status: z.literal("active"), is_viewer_account: z.union([z.literal(false), z.null()]), updated_at: z.string().nullable() }).passthrough(),
  tasks: z.array(taskSchema).max(31),
  preserved_tasks: z.array(z.object({ date, existing: z.array(existingTaskSchema).min(1) })).max(31),
  existing_tasks: z.array(existingTaskSchema),
  needs_review: z.array(z.object({ code: z.string().min(1), message: z.string().optional(), task_id: uuid.optional(),
    source_month_id: uuid.optional(), existing_plan_count: count.optional() }).passthrough()),
  can_commit: z.boolean(), allocation_hash: hash,
  existing_executive_plans: z.array(z.record(z.unknown())),
  prior_approved_tasks: z.array(z.object({ id: uuid, due_date: date, target: count, dedupe_key: z.string(),
    assigned_employee_id: uuid, user_id: uuid, allocation_hash: hash }).passthrough()),
}).passthrough();
const envelopeSchema = z.object({
  source: z.literal("rules-v1"), preview_only: z.literal(true), requires_confirmation: z.literal(true),
  writes_enabled: z.boolean(), database_enabled: z.boolean(), edge_enabled: z.boolean(),
  writes_performed: z.literal(0), notifications_sent: z.literal(0), review_hash: hash,
  review_json: z.string().max(200_000), review: reviewSchema,
});
const commitSchema = z.object({
  source: z.literal("rules-v1"), preview_only: z.literal(false), status: z.enum(["applied", "already_applied"]),
  organization_id: uuid, user_id: uuid, review_hash: hash, created_tasks: count, task_ids: z.array(uuid).max(31),
  preserved_dates: count.max(31), writes_performed: count, notifications_sent: z.literal(0), plans_created: z.literal(0),
});
type Selection = z.infer<typeof selectionSchema>;
type Envelope = z.infer<typeof envelopeSchema>;
type CommitResult = z.infer<typeof commitSchema>;
type PreviewTask = { id: string; title: string; due_date: string; target: number | null; assigned_employee_id: string; metadata: Record<string, unknown> | unknown[] };
type Props = { organizationId: string; userId: string; tasks: PreviewTask[]; tasksPath: string };
type Group = { key: string; planId: string; monthId: string; employeeId: string; month: string; title: string; dates: Map<string, number>; ambiguous: boolean };
// Only an uncertainty marker survives remounts, never a review, hash, or payload.
// This is isolated by both user and organization and is deliberately not stored remotely.
const uncertainScopes = new Set<string>();
const invalidReview = () => new Error("تعذر التحقق من سلامة المراجعة ونطاقها. اطلب مراجعة جديدة؛ لم يُرسل طلب حفظ.");
const stable = (value: unknown): string => JSON.stringify(value && typeof value === "object"
  ? Array.isArray(value) ? value.map(item => JSON.parse(stable(item))) : Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(stable(item))]))
  : value);
async function validateEnvelope(value: unknown, selection: Selection, userId: string): Promise<Envelope> {
  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) throw invalidReview();
  const envelope = parsed.data;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(envelope.review_json))), byte => byte.toString(16).padStart(2, "0")).join("");
  let raw: unknown;
  try { raw = JSON.parse(envelope.review_json); } catch { throw invalidReview(); }
  const review = reviewSchema.safeParse(raw);
  if (!review.success || digest !== envelope.review_hash || stable(raw) !== stable((value as { review: unknown }).review)) throw invalidReview();
  const packet = review.data;
  const month = packet.source_months.find(row => row.id === selection.source_month_id);
  const sameScope = (row: { organization_id?: string }) => row.organization_id === selection.organization_id;
  const dates = [...selection.task_dates].sort();
  if (packet.user_id !== userId || stable(packet.selection) !== stable(selection) || new Set(dates).size !== dates.length ||
      !sameScope(packet.source_plan) || packet.source_plan.id !== selection.source_plan_id || packet.source_plan.responsible_employee_id !== selection.assigned_employee_id ||
      !sameScope(packet.employee) || packet.employee.id !== selection.assigned_employee_id || !month ||
      packet.source_months.some(row => !sameScope(row) || row.operational_plan_id !== selection.source_plan_id) ||
      new Set(packet.source_months.map(row => row.month)).size !== packet.source_months.length ||
      dates.some(day => day.slice(0, 7) !== `${packet.source_plan.year}-${String(month.month).padStart(2, "0")}` || [5, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) ||
      packet.can_commit !== (packet.needs_review.length === 0) ||
      (envelope.writes_enabled && (!envelope.database_enabled || !packet.can_commit || !envelope.edge_enabled)) ||
      (envelope.writes_enabled !== (envelope.edge_enabled && envelope.database_enabled && packet.can_commit))) throw invalidReview();
  const represented = [...packet.tasks.map(task => task.due_date), ...packet.preserved_tasks.map(row => row.date)];
  if (stable([...represented].sort()) !== stable(dates) || new Set(packet.tasks.map(task => task.dedupe_key)).size !== packet.tasks.length ||
      packet.tasks.some(task => !sameScope(task) || task.assigned_employee_id !== selection.assigned_employee_id || task.user_id !== packet.employee.user_id ||
        task.metadata.source_plan_id !== selection.source_plan_id || task.metadata.source_month_id !== selection.source_month_id ||
        task.metadata.target !== task.target || task.metadata.template_id !== task.template_id ||
        task.metadata.evidence.source_plan_id !== selection.source_plan_id || task.metadata.evidence.source_month_id !== selection.source_month_id ||
        task.metadata.evidence.monthly_target !== month.monthly_target || task.metadata.evidence.annual_target !== packet.source_plan.annual_target) ||
      packet.preserved_tasks.some(row => row.existing.some(task => !packet.existing_tasks.some(existing => stable(existing) === stable(task))))) throw invalidReview();
  return { ...envelope, review: packet };
}
function validateCommit(value: unknown, envelope: Envelope, userId: string): CommitResult {
  const parsed = commitSchema.safeParse(value);
  if (!parsed.success) throw new Error("unverified_commit");
  const result = parsed.data;
  if (result.organization_id !== envelope.review.selection.organization_id || result.user_id !== userId || result.review_hash !== envelope.review_hash ||
      result.preserved_dates !== envelope.review.preserved_tasks.length || new Set(result.task_ids).size !== result.task_ids.length ||
      result.task_ids.length !== envelope.review.tasks.length ||
      (result.status === "applied" ? result.created_tasks !== result.task_ids.length || result.writes_performed !== result.created_tasks : result.created_tasks !== 0 || result.writes_performed !== 0)) throw new Error("unverified_commit");
  return result;
}
const reviewReasons: Record<string, string> = {
  existing_daily_plans_require_review: "توجد خطط يومية مسجلة تحتاج إلى مطابقة بشرية قبل أي حفظ.",
  historical_task_missing: "تعذر العثور على مهمة معتمدة سابقاً؛ يلزم فحص السجل.",
  historical_allocation_requires_review: "تغيّر مصدر أو توزيع مهمة سابقة؛ يلزم فحصه دون استبدالها.",
  historical_target_requires_review: "مستهدفات المهام السابقة تحتاج إلى مطابقة بشرية.",
};
class ApprovalError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
async function requestApproval(body: Record<string, unknown>, signal: AbortSignal) {
  const { data, error } = await supabase.functions.invoke("apply-rule-preview", { body, signal, timeout: 30_000 });
  if (error) {
    let details: { error?: unknown; message?: unknown } = {};
    if (error.context instanceof Response) { try { details = await error.context.clone().json(); } catch { /* A lost response is not proof of rollback. */ } }
    throw new ApprovalError(typeof details.message === "string" ? details.message : "تعذر إكمال الطلب. تحقق من الاتصال وصلاحياتك.", typeof details.error === "string" ? details.error : "unknown");
  }
  if (data && typeof data === "object" && typeof data.error === "string") throw new ApprovalError(typeof data.message === "string" ? data.message : "تعذر إكمال الطلب.", data.error);
  return data as unknown;
}
const definiteDenials = new Set(["approval_forbidden", "approval_source_not_found", "approval_source_requires_review", "approval_invalid_selection", "approval_stale_review", "approval_confirmation_required", "approval_persistence_disabled", "approval_unsafe_database_hooks", "invalid_approval_request", "confirmation_required", "review_hash_required"]);

export function RuleApprovalPanel(props: Props) {
  // A new preview, user, or organization never inherits an earlier review.
  return <ApprovalSession key={JSON.stringify([props.userId, props.organizationId, props.tasks])} {...props} />;
}
function ApprovalSession({ organizationId, userId, tasks, tasksPath }: Props) {
  const scope = `${userId}:${organizationId}`;
  const { groups, excluded } = useMemo(() => {
    const grouped = new Map<string, Group>();
    let excluded = 0;
    for (const task of tasks) {
      const metadata = task.metadata as Record<string, unknown>;
      if (!uuid.safeParse(metadata.source_plan_id).success || !uuid.safeParse(metadata.source_month_id).success ||
          !uuid.safeParse(task.assigned_employee_id).success || !date.safeParse(task.due_date).success ||
          typeof metadata.template_id !== "string" || !metadata.template_id.endsWith(":during") || !count.positive().safeParse(task.target).success) { excluded++; continue; }
      const planId = String(metadata.source_plan_id).toLowerCase(), monthId = String(metadata.source_month_id).toLowerCase(), employeeId = task.assigned_employee_id.toLowerCase();
      const key = JSON.stringify([planId, monthId, employeeId, task.due_date.slice(0, 7)]);
      const group = grouped.get(key) ?? { key, planId, monthId, employeeId, month: task.due_date.slice(0, 7), title: task.title, dates: new Map<string, number>(), ambiguous: false };
      if (group.dates.has(task.due_date)) group.ambiguous = true;
      group.dates.set(task.due_date, task.target!);
      grouped.set(key, group);
    }
    return { groups: [...grouped.values()].filter(group => !group.ambiguous), excluded: excluded + [...grouped.values()].filter(group => group.ambiguous).reduce((total, group) => total + group.dates.size, 0) };
  }, [tasks]);
  const [groupKey, setGroupKey] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [review, setReview] = useState<Envelope | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"review" | "commit" | null>(null);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(uncertainScopes.has(scope));
  const [saved, setSaved] = useState<CommitResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    const requests = request, versions = generation;
    mounted.current = true;
    return () => { mounted.current = false; versions.current++; requests.current?.abort(); requests.current = null; };
  }, []);
  const group = groups.find(item => item.key === groupKey);
  const selection: Selection | null = group && selectedDates.length ? { organization_id: organizationId.toLowerCase(), source_plan_id: group.planId, source_month_id: group.monthId, assigned_employee_id: group.employeeId, task_dates: [...selectedDates].sort() } : null;
  const clearReview = () => { generation.current++; request.current?.abort(); request.current = null; setBusy(null); setReview(null); setConfirmed(false); setMessage(""); setSaved(null); };
  const run = async (action: "review" | "commit") => {
    if (!selection || request.current || uncertain || saved || !uuid.safeParse(userId).success || !uuid.safeParse(organizationId).success) return;
    if (action === "commit" && (!review || !confirmed || !review.writes_enabled || !review.review.can_commit || !review.review.tasks.length || stable(review.review.selection) !== stable(selection))) return;
    const currentReview = review;
    const abort = new AbortController();
    const sequence = ++generation.current;
    request.current = abort;
    setBusy(action); setMessage(""); setConfirmed(false);
    if (action === "review") setReview(null);
    else uncertainScopes.add(scope); // A transport abort cannot undo a committed transaction.
    try {
      const data = await requestApproval(action === "review" ? { action, ...selection } : { action, ...selection, confirmed: true, review_hash: currentReview!.review_hash }, abort.signal);
      if (!mounted.current || abort.signal.aborted || generation.current !== sequence) return;
      if (action === "review") {
        const verified = await validateEnvelope(data, selection, userId);
        if (!mounted.current || abort.signal.aborted || generation.current !== sequence) return;
        setReview(verified);
      } else {
        const result = validateCommit(data, currentReview!, userId);
        uncertainScopes.delete(scope); setSaved(result); setReview(null);
      }
    } catch (error) {
      if (!mounted.current || abort.signal.aborted || generation.current !== sequence) return;
      setReview(null);
      if (action === "commit" && !(error instanceof ApprovalError && definiteDenials.has(error.code))) {
        setUncertain(true); setMessage("نتيجة الحفظ غير مؤكدة. قد تكون المهام حُفظت بالفعل. افتح قائمة المهام وتحقق من الموظف والتواريخ قبل أي محاولة أخرى. لن نكرر الطلب تلقائياً.");
      } else {
        if (action === "commit") uncertainScopes.delete(scope);
        setMessage(error instanceof Error ? error.message : "تعذر التحقق من الطلب.");
      }
    } finally {
      if (mounted.current && generation.current === sequence) { request.current = null; setBusy(null); }
    }
  };
  const month = review?.review.source_months.find(row => row.id === review.review.selection.source_month_id);
  const canConfirm = Boolean(review?.writes_enabled && review.review.can_commit && review.review.tasks.length && !busy && !uncertain && !saved);
  return <Card dir="rtl" aria-label="اعتماد مهام شهرية محددة" className="border-primary/25"><CardHeader><CardTitle className="text-lg">مراجعة واعتماد مهام شهرية محددة</CardTitle></CardHeader><CardContent className="space-y-5 text-sm leading-7">
    <p>اختر مصدر شهر محفوظ وموظفه المسجل، ثم الأيام التي تريد مراجعتها. المراجعة لا تحفظ شيئاً. الحفظ يتطلب تفعيل بوابات الخادم، صلاحية إدارية، وموافقتك الصريحة على النتيجة المعروضة.</p>
    <p className="text-xs text-muted-foreground">تُنشأ مهام تنفيذ فقط، بلا إشعارات أو تغيير درجات التقييم. المستهدف اليومي محسوب على أيام العمل في الشهر الكامل، حتى لو اخترت أياماً أقل.</p>
    {excluded > 0 && <p className="rounded-lg bg-amber-50/60 p-3">بعض المقترحات غير مؤهلة لهذا المسار. الخطة السنوية وحدها لا تكفي: يلزم مستهدف شهري محفوظ بمعرّف مصدر واضح. المقترحات غير المكتملة أو المتعارضة تبقى للمعاينة فقط.</p>}
    {!groups.length ? <p className="rounded-lg border border-dashed p-4">لا يوجد مصدر شهري محفوظ مؤهل للاعتماد في هذه المعاينة. احفظ مستهدفاً شهرياً صريحاً في الخطة أولاً ثم شغّل المعاينة مجدداً.</p> : <>
      <label className="block space-y-2"><span className="font-medium">المصدر الشهري والمسؤول المسجل</span><select aria-label="المصدر الشهري والمسؤول المسجل" value={groupKey} disabled={busy === "commit" || uncertain || Boolean(saved)} onChange={event => { clearReview(); setGroupKey(event.target.value); setSelectedDates([]); }} className="h-11 w-full rounded-md border bg-background px-3 disabled:opacity-50"><option value="">اختر مجموعة واحدة للمراجعة</option>{groups.map(item => <option key={item.key} value={item.key}>{item.title} · {item.month} · مسؤول {item.employeeId}</option>)}</select></label>
      {group && <fieldset disabled={busy === "commit" || uncertain || Boolean(saved)} className="space-y-2"><legend className="font-medium">الأيام المحددة للمراجعة</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...group.dates].sort(([a], [b]) => a.localeCompare(b)).map(([day, target]) => <label key={day} className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" aria-label={`مراجعة يوم ${day}`} checked={selectedDates.includes(day)} onChange={event => { clearReview(); setSelectedDates(previous => event.target.checked ? [...previous, day] : previous.filter(value => value !== day)); }} /><span><bdi>{day}</bdi> · مستهدف المعاينة: {target.toLocaleString("ar-SA")}</span></label>)}</div></fieldset>}
      <div className="flex flex-wrap items-center gap-3"><Button onClick={() => run("review")} disabled={!selection || Boolean(busy) || uncertain || Boolean(saved)}>{busy === "review" ? "جارٍ التحقق من المراجعة…" : "مراجعة المهام المحددة"}</Button>{busy === "review" && <Button variant="outline" onClick={clearReview}>إلغاء المراجعة</Button>}</div>
    </>}
    {message && <p role="alert" className="rounded-lg border border-destructive/30 p-4">{message}</p>}
    {uncertain && <div role="alert" className="space-y-3 rounded-lg border border-amber-500/40 p-4"><p>يلزم التحقق من قائمة المهام قبل بدء مراجعة جديدة؛ إلغاء الانتظار أو مغادرة الشاشة لا يلغي طلب حفظ وصل إلى الخادم.</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link to={tasksPath}>فتح قائمة المهام للتحقق</Link></Button><Button variant="outline" onClick={() => { uncertainScopes.delete(scope); setUncertain(false); clearReview(); }}>راجعت قائمة المهام؛ بدء مراجعة جديدة</Button></div></div>}
    {review && <section aria-label="نتيجة مراجعة الاعتماد" className="space-y-4 rounded-xl border p-4">
      <h3 className="font-bold">الموظف المسؤول: {review.review.employee.full_name}</h3>
      <p>النشاط: {review.review.source_plan.activity_name} · الشهر: <bdi>{review.review.source_plan.year}-{String(month!.month).padStart(2, "0")}</bdi> · المستهدف الشهري: {month!.monthly_target.toLocaleString("ar-SA")}</p>
      <p>الأيام التي راجعتها: {review.review.selection.task_dates.join("، ")}</p>
      <ul className="space-y-1 rounded-lg bg-muted/40 p-3"><li>بوابة قاعدة البيانات: {review.database_enabled ? "مفعّلة" : "معطّلة"}</li><li>بوابة خدمة الحفظ: {review.edge_enabled ? "مفعّلة" : "معطّلة"}</li><li>فحص بيانات المصدر: {review.review.can_commit ? "لا توجد موانع مسجلة في هذه المراجعة" : "تحتاج إلى مراجعة بشرية قبل الحفظ"}</li><li>الحفظ الفعلي: {review.writes_enabled ? "مسموح بعد التأكيد الصريح" : "معطّل؛ لن يُتاح زر الحفظ حتى تسمح جميع البوابات"}</li></ul>
      {!review.writes_enabled && <p role="status" className="rounded-lg bg-amber-50/60 p-3">الحفظ غير مفعّل لهذه المراجعة. تفعيل الخدمة وقاعدة البيانات واعتماد اختبارات بيئة التجربة خطوات منفصلة لا تجريها هذه الشاشة.</p>}
      {review.review.needs_review.length > 0 && <ul className="list-disc space-y-2 pr-5">{review.review.needs_review.map((item, index) => <li key={index}>{item.message || reviewReasons[item.code] || "يلزم فحص بشري لبيانات المصدر أو المهام السابقة."}{item.task_id && <span> معرّف المهمة: <bdi>{item.task_id}</bdi></span>}</li>)}</ul>}
      <h4 className="font-semibold">المهام الجديدة ({review.review.tasks.length.toLocaleString("ar-SA")})</h4>
      {review.review.tasks.map(task => <div key={task.dedupe_key} className="rounded-lg border p-3"><p className="font-medium">{task.title}</p><p><bdi>{task.due_date}</bdi> · المستهدف: {task.target.toLocaleString("ar-SA")} · {review.review.employee.full_name}</p><p className="text-xs text-muted-foreground">{task.description}</p></div>)}
      {!review.review.tasks.length && <p>لا توجد مهام جديدة للحفظ في هذه المراجعة.</p>}
      <h4 className="font-semibold">الصفوف القائمة المحفوظة دون تغيير ({review.review.existing_tasks.length.toLocaleString("ar-SA")})</h4>
      {review.review.existing_tasks.length ? review.review.existing_tasks.map(task => <p key={task.id} className="break-words rounded-lg border p-3"><bdi>{task.id}</bdi> · {task.due_date || "دون تاريخ"} · الحالة: {task.status}</p>) : <p>لا توجد صفوف قائمة مرتبطة في نطاق المصدر.</p>}
      <p>أيام مختارة تغطيها مهام قائمة: {review.review.preserved_tasks.map(row => row.date).join("، ") || "لا يوجد"}</p>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer">المصدر ودليل المراجعة الكامل</summary><pre dir="ltr" className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-left text-xs">{review.review_json}</pre></details>
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={!canConfirm} onChange={event => setConfirmed(event.target.checked)} /><span>راجعت الموظف والأيام والعناوين والمستهدفات والصفوف المحفوظة، وأوافق على إنشاء هذه المهام المحددة.</span></label>
      <Button onClick={() => run("commit")} disabled={!canConfirm || !confirmed}>تأكيد حفظ المهام المحددة</Button>
    </section>}
    {busy === "commit" && <p role="status">جارٍ التحقق والحفظ. لا تكرر الطلب؛ مغادرة الشاشة لا تلغي عملية وصلت إلى الخادم.</p>}
    {saved && <div role="status" className="space-y-3 rounded-lg border p-4"><p>{saved.status === "already_applied" ? "سبق تطبيق هذا الاعتماد؛ لم تُنشأ مهام إضافية." : `حُفظت ${saved.created_tasks.toLocaleString("ar-SA")} مهمة للموظف والأيام التي اعتمدتها.`} لم تُرسل إشعارات.</p><Button asChild variant="outline"><Link to={tasksPath}>عرض قائمة المهام</Link></Button></div>}
  </CardContent></Card>;
}
