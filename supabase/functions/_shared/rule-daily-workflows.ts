/**
 * Pure daily automation proposal. Never authenticates, reads a database, schedules
 * a job, sends a notification, changes evaluation weights, or assesses quality.
 * A future adapter MUST authenticate and assemble a complete, current snapshot,
 * verify approval authority, and revalidate it transactionally before applying.
 */
import { dateInTimeZone, deterministicPreviewId, previewTasks, type SourcePlan } from './rule-plans.ts';

export const DAILY_RULE_VERSION = 'daily-workflows-v1';
export const DAILY_LIMITS = { records: 10_000, employees: 500, sources: 200, drafts: 500, templates: 20, recipients: 100, candidates: 10_000 } as const;
type Scoped = { organization_id: string | null };
export type DailyApproval = Scoped & {
  /** Trusted adapter attestation, never a browser-supplied permission. */
  authorized: true;
  approved_by_employee_id: string;
  approved_at: string;
  revision: string;
};
/** Known fields mirror employees. Capacity is an explicit policy input, not a DB column. */
export type DailyEmployee = Scoped & {
  id: string; user_id: string | null; status: string | null; is_viewer_account: boolean;
  work_start_time: string | null; work_end_time: string | null;
  daily_capacity_minutes: number | null;
};
/** Known fields mirror tasks. Completion percentages/quality are deliberately not inputs. */
export type DailyExistingTask = Scoped & {
  id: string; assigned_employee_id: string | null; title: string; status: string;
  due_date: string | null; created_at: string; started_at?: string | null; completed_at: string | null;
  estimated_time_minutes: number | null; actual_time_minutes?: number | null; dedupe_key?: string | null;
  executive_plan_id?: string | null; source_activity_id?: string | null; phase?: string | null;
  metadata?: Record<string, unknown> | null;
};
export type DailyWorkCalendar = { timezone: 'Asia/Riyadh'; weekend_days: number[]; excluded_dates: string[] };
export type ApprovedDailyPlan = {
  plan: SourcePlan; approval: DailyApproval; estimated_time_minutes: number | null;
  /** Calendar approved with the source: later holidays must not silently redistribute targets. */
  allocation_calendar: DailyWorkCalendar;
};
export type DailyRecurrence =
  | { frequency: 'daily'; interval: number }
  | { frequency: 'weekly'; interval: number; weekdays: number[] }
  | { frequency: 'monthly'; interval: number; day_of_month: number; missing_day: 'skip' | 'review' };
export type ApprovedScheduleGroup = Scoped & {
  id: string; status: 'active' | 'completed' | 'cancelled'; approval: DailyApproval;
  /** Every recipient must be an explicitly approved responsible employee. No inference or substitution. */
  responsible_employee_ids: string[];
  start_date: string; end_date: string | null; recurrence: DailyRecurrence;
  non_working_day: 'skip' | 'review';
  templates: { id: string; title: string; description: string; estimated_time_minutes: number | null }[];
};
/** Leave and review records are normalized adapter contracts; no such DB schema is assumed. */
export type DailyLeave = Scoped & {
  id: string; employee_id: string; start_date: string; end_date: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled'; approval: DailyApproval | null;
};
export type DailyCompletionReview = Scoped & {
  task_id: string; evidence_status: 'unknown' | 'submitted' | 'verified' | 'rejected';
  supervisor_status: 'pending' | 'approved' | 'rejected'; approval: DailyApproval | null;
};
/** One approved override per task; multiple records require reconciliation by the adapter. */
export type DailyDeadlineChange = Scoped & {
  task_id: string; previous_due_date: string | null; new_due_date: string; approval: DailyApproval;
};
export type DailyNotificationReceipt = Scoped & { dedupe_key: string; task_id: string; employee_id: string; local_date: string };
export type DailyWorkflowInput = {
  organization_id: string;
  authorization: { organization_id: string; actor_user_id: string; authorized: true };
  now: string;
  calendar: DailyWorkCalendar;
  /** All arrays must be complete as of now. False blocks all actionable drafts and aggregate counts. */
  snapshot_complete: boolean;
  employees: DailyEmployee[]; plans: ApprovedDailyPlan[]; schedule_groups: ApprovedScheduleGroup[];
  tasks: DailyExistingTask[]; leave: DailyLeave[]; completion_reviews: DailyCompletionReview[];
  deadline_changes: DailyDeadlineChange[]; notification_receipts: DailyNotificationReceipt[];
  /** Required because the repository has no authoritative leave-approval/scheduling policy. */
  leave_policy: { approved_leave: 'skip' | 'review'; pending_leave: 'review'; suppress_notifications: true } | null;
};
export type DailyReviewItem = { code: string; message: string; employee_id?: string; task_id?: string; source_id?: string };
export type DailyTaskDraft = {
  dedupe_key: string; organization_id: string; assigned_employee_id: string; user_id: string;
  title: string; description: string; due_date: string; status: 'upcoming'; priority: 'medium';
  estimated_time_minutes: number; ai_generated: false; source: 'rules_daily_preview';
  source_activity_id: null; executive_plan_id: null; phase: 'during';
  metadata: {
    rule_version: string; source_kind: 'plan' | 'schedule'; source_id: string; source_plan_id: string | null;
    source_month_id: string | null; template_id: string; occurrence_date: string; local_date: string;
    source_approval_revision: string; no_quality_assessment: true; target: number | null; deadline_at: string | null;
  };
};
export type DailyNotificationDraft = {
  dedupe_key: string; organization_id: string; employee_id: string; task_id: string; user_id: string;
  channel: 'in_app'; kind: 'task_overdue'; local_date: string; effective_due_at: string;
  title: string; message: string;
};
export type DailyTaskTracking = {
  task_id: string; employee_id: string | null; state: 'open' | 'cancelled' | 'awaiting_human_review' | 'approved' | 'unknown';
  effective_due_at: string | null; claimed_complete: boolean | null; claimed_completed_at: string | null;
  evidence_status: 'unknown' | 'submitted' | 'verified' | 'rejected';
  supervisor_status: 'unknown' | 'pending' | 'approved' | 'rejected'; approved_at: string | null;
  overdue_open: boolean | null; claimed_on_time: boolean | null; approved_on_time: boolean | null;
  documented_elapsed_minutes: number | null; quality_score: null;
};
export type DailyEmployeeTracking = {
  employee_id: string; local_date: string; data_status: 'complete' | 'unknown';
  tasks_due_today: number | null; claimed_completed_today: number | null; supervisor_approved_today: number | null;
  overdue_open: number | null; completion_review_unknown: number | null; unknown_deadlines: number | null;
  capacity_minutes: number | null; reserved_minutes: number | null; completed_capacity_minutes: number | null; planned_minutes: number;
  quality_score: null; rank: null;
};
export class DailyRuleError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'DailyRuleError'; this.code = code; }
}
function fail(code: string, message: string): never { throw new DailyRuleError(code, message); }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const dateValid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function instant(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !dateValid(value.slice(0, 10))) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
function timeMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}
const terminal = (status: string) => ['completed', 'done', 'executed'].includes(status);
const cancelled = (status: string) => ['cancelled', 'canceled'].includes(status);
const open = (status: string) => ['upcoming', 'pending', 'in_progress', 'returned', 'delayed', 'stalled'].includes(status);
const key = (...parts: string[]) => parts.map(encodeURIComponent).join(':');
export const dailyTaskKey = (org: string, kind: 'plan' | 'schedule', source: string, employee: string, date: string, template: string) =>
  key(DAILY_RULE_VERSION, 'task', org, kind, source, employee, date, template);
/** At most one reminder per task/employee/local day, including same-day deadline edits. */
export const dailyNotificationKey = (org: string, task: string, employee: string, date: string) =>
  key(DAILY_RULE_VERSION, 'overdue', org, task, employee, date);

function assertScope(org: string, rows: Scoped[]) {
  if (rows.some(row => !record(row) || row.organization_id !== org)) fail('organization_scope_mismatch', 'All input records must belong to the authorized organization.');
}
function unique(rows: { id: string }[], type: string) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!id(row.id) || seen.has(row.id)) fail('duplicate_or_invalid_identity', `Reconcile duplicate or invalid ${type} IDs before planning.`);
    seen.add(row.id);
  }
}
function validateInput(input: DailyWorkflowInput) {
  if (!record(input) || !id(input.organization_id) || !record(input.authorization) || input.authorization.authorized !== true || input.authorization.organization_id !== input.organization_id || !id(input.authorization.actor_user_id)) fail('authorization_required', 'An authenticated organization-scoped authorization snapshot is required.');
  const now = instant(input.now);
  if (now === null) fail('invalid_clock', 'Supply a valid timestamp with an explicit offset.');
  const arrays = [input.employees, input.plans, input.schedule_groups, input.tasks, input.leave, input.completion_reviews, input.deadline_changes, input.notification_receipts];
  if (arrays.some(rows => !Array.isArray(rows))) fail('invalid_snapshot', 'Every snapshot collection is required.');
  if (arrays.reduce((sum, rows) => sum + rows.length, 0) > DAILY_LIMITS.records || input.employees.length > DAILY_LIMITS.employees || input.plans.length + input.schedule_groups.length > DAILY_LIMITS.sources) fail('record_limit', 'The bounded daily snapshot limit was exceeded.');
  if (typeof input.snapshot_complete !== 'boolean') fail('invalid_snapshot', 'Explicit snapshot completeness is required.');
  assertScope(input.organization_id, [...input.employees, ...input.tasks, ...input.schedule_groups, ...input.leave, ...input.completion_reviews, ...input.deadline_changes, ...input.notification_receipts]);
  if (input.plans.some(source => !record(source) || !record(source.plan))) fail('invalid_plan', 'Plan wrappers require a source plan.');
  assertScope(input.organization_id, input.plans.map(source => source.plan));
  const approvals = [...input.plans.map(source => source.approval), ...input.schedule_groups.map(source => source.approval), ...input.leave.filter(row => row.approval).map(row => row.approval!), ...input.completion_reviews.filter(row => row.approval).map(row => row.approval!), ...input.deadline_changes.map(row => row.approval)];
  assertScope(input.organization_id, approvals.filter(approval => approval != null));
  unique(input.employees, 'employee'); unique(input.tasks, 'task'); unique(input.schedule_groups, 'schedule'); unique(input.leave, 'leave'); unique(input.plans.map(source => source.plan), 'plan');
  for (const calendar of [input.calendar, ...input.plans.map(wrapper => wrapper.allocation_calendar)]) {
    if (!record(calendar) || calendar.timezone !== 'Asia/Riyadh' || !Array.isArray(calendar.weekend_days) || calendar.weekend_days.some(day => !integer(day, 0, 6)) || !Array.isArray(calendar.excluded_dates) || calendar.excluded_dates.some(date => !dateValid(date)) || calendar.excluded_dates.length > 3660) fail('invalid_calendar', 'Provide explicit current and approved allocation calendars in Asia/Riyadh.');
  }
  if (input.leave_policy !== null && (!record(input.leave_policy) || !['skip', 'review'].includes(input.leave_policy.approved_leave) || input.leave_policy.pending_leave !== 'review' || input.leave_policy.suppress_notifications !== true)) fail('invalid_leave_policy', 'An explicit approved/pending leave policy is required.');
  let fanout = input.plans.length;
  for (const group of input.schedule_groups) {
    if (!Array.isArray(group.templates) || !Array.isArray(group.responsible_employee_ids)) fail('invalid_schedule', 'Schedule templates and responsible employee IDs are required.');
    if (group.templates.length > DAILY_LIMITS.templates || group.responsible_employee_ids.length > DAILY_LIMITS.recipients) fail('fanout_limit', 'Schedule fanout exceeds the safe limit.');
    fanout += group.templates.length * group.responsible_employee_ids.length;
    if (fanout > DAILY_LIMITS.candidates) fail('fanout_limit', 'The total candidate fanout exceeds the safe limit.');
    unique(group.templates, 'template');
    if (new Set(group.responsible_employee_ids).size !== group.responsible_employee_ids.length) fail('duplicate_or_invalid_identity', 'Schedule recipient IDs must be unique.');
  }
  for (const wrapper of input.plans) {
    if (wrapper.plan.months && (!Array.isArray(wrapper.plan.months) || wrapper.plan.months.length > 12)) fail('invalid_plan', 'A source plan may contain at most twelve monthly allocations.');
  }
  return now;
}

/** Only today's occurrence is proposed. No hidden backfill, shifting, or target redistribution. */
function recurrenceToday(group: ApprovedScheduleGroup, today: string): 'due' | 'not_due' | 'review' {
  const r = group.recurrence;
  if (!dateValid(group.start_date) || (group.end_date !== null && (!dateValid(group.end_date) || group.end_date < group.start_date)) || !record(r) || !integer(r.interval, 1, 366) || !['skip', 'review'].includes(group.non_working_day)) return 'review';
  if (today < group.start_date || (group.end_date && today > group.end_date)) return 'not_due';
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${group.start_date}T00:00:00Z`)) / 86_400_000);
  if (r.frequency === 'daily') return days % r.interval === 0 ? 'due' : 'not_due';
  if (r.frequency === 'weekly') {
    if (!Array.isArray(r.weekdays) || !r.weekdays.length || r.weekdays.some(day => !integer(day, 0, 6)) || new Set(r.weekdays).size !== r.weekdays.length) return 'review';
    // Sunday-based calendar weeks anchored to the week containing start_date.
    const startWeekday = new Date(`${group.start_date}T00:00:00Z`).getUTCDay();
    return Math.floor((days + startWeekday) / 7) % r.interval === 0 && r.weekdays.includes(new Date(`${today}T00:00:00Z`).getUTCDay()) ? 'due' : 'not_due';
  }
  if (r.frequency === 'monthly') {
    if (!integer(r.day_of_month, 1, 31) || !['skip', 'review'].includes(r.missing_day)) return 'review';
    const months = (Number(today.slice(0, 4)) - Number(group.start_date.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(group.start_date.slice(5, 7));
    if (months % r.interval !== 0) return 'not_due';
    const lastDay = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
    if (r.day_of_month > lastDay) return r.missing_day === 'review' ? 'review' : 'not_due';
    return Number(today.slice(8, 10)) === r.day_of_month ? 'due' : 'not_due';
  }
  return 'review';
}

export function planDailyWorkflows(input: DailyWorkflowInput) {
  const now = validateInput(input);
  const today = dateInTimeZone(input.now, input.calendar);
  const localMinute = new Date(now + 3 * 60 * 60 * 1000).getUTCHours() * 60 + new Date(now + 3 * 60 * 60 * 1000).getUTCMinutes();
  const workingDay = !input.calendar.weekend_days.includes(new Date(`${today}T00:00:00Z`).getUTCDay()) && !input.calendar.excluded_dates.includes(today);
  const needs_review: DailyReviewItem[] = [];
  const review = (code: string, message: string, refs: Omit<DailyReviewItem, 'code' | 'message'> = {}) => needs_review.push({ code, message, ...refs });
  const skipped: { source_id?: string; task_id?: string; employee_id?: string; reason: string }[] = [];
  const task_drafts: DailyTaskDraft[] = [];
  const notification_drafts: DailyNotificationDraft[] = [];
  const employees = new Map(input.employees.map(employee => [employee.id, employee]));
  const tasks = new Map(input.tasks.map(task => [task.id, task]));
  const approvalValid = (approval: DailyApproval | null | undefined) => {
    if (!record(approval) || approval.authorized !== true || !id(approval.revision) || !id(approval.approved_by_employee_id)) return false;
    const at = instant(approval.approved_at); const approver = employees.get(approval.approved_by_employee_id);
    return at !== null && at <= now && !!approver && !approver.is_viewer_account;
  };
  if (!input.snapshot_complete) review('incomplete_snapshot', 'Complete the authorized snapshot before generating drafts or using daily aggregate counts.');
  if (!input.leave_policy) review('leave_policy_required', 'Approve an explicit leave policy before generating tasks or notifications.');
  const ready = input.snapshot_complete && input.leave_policy !== null;
  const unavailable = new Map<string, 'leave' | 'review'>();
  const capacity = new Map<string, { total: number | null; reserved: number | null; consumed: number | null; planned: number; start: number | null; end: number | null }>();
  for (const employee of input.employees) {
    const start = timeMinutes(employee.work_start_time), end = timeMinutes(employee.work_end_time);
    const minutes = employee.daily_capacity_minutes;
    const valid = start !== null && end !== null && end > start && integer(minutes, 0, end - start);
    capacity.set(employee.id, { total: valid ? minutes : null, reserved: valid ? 0 : null, consumed: valid ? 0 : null, planned: 0, start, end });
    if (!valid) review('working_hours_or_capacity_required', 'Explicit same-day working hours and bounded capacity are required; overnight shifts need a separate policy.', { employee_id: employee.id });
    if (!['active', 'on_leave', 'inactive'].includes(employee.status ?? '') || employee.is_viewer_account) unavailable.set(employee.id, 'review');
    if (employee.status === 'inactive') unavailable.set(employee.id, 'review');
    if (employee.status === 'on_leave') unavailable.set(employee.id, 'leave');
  }
  for (const leave of input.leave) {
    if (!employees.has(leave.employee_id)) { review('unresolved_leave_employee', 'Leave references an employee missing from this organization snapshot.'); continue; }
    if (!dateValid(leave.start_date) || !dateValid(leave.end_date) || leave.end_date < leave.start_date || !['approved', 'pending', 'rejected', 'cancelled'].includes(leave.status)) {
      unavailable.set(leave.employee_id, 'review'); review('invalid_leave', 'Reconcile the leave record before assigning work.', { employee_id: leave.employee_id }); continue;
    }
    if (today < leave.start_date || today > leave.end_date || ['rejected', 'cancelled'].includes(leave.status)) continue;
    if (leave.status === 'pending' || !approvalValid(leave.approval)) {
      unavailable.set(leave.employee_id, 'review'); review('leave_requires_review', 'Pending or unverified leave requires human review.', { employee_id: leave.employee_id });
    } else if (!unavailable.has(leave.employee_id)) unavailable.set(leave.employee_id, 'leave');
  }
  for (const [employeeId, state] of unavailable) {
    if (state === 'leave' && input.leave_policy?.approved_leave === 'review') review('approved_leave_reschedule_review', 'Approve a reschedule or skip; work is not reassigned automatically.', { employee_id: employeeId });
    else if (state === 'review') review('employee_unavailable', 'The employee is unavailable or their status needs review.', { employee_id: employeeId });
  }
  const revisions = new Map<string, DailyDeadlineChange[]>();
  const completion = new Map<string, DailyCompletionReview[]>();
  for (const row of input.deadline_changes) { revisions.set(row.task_id, [...(revisions.get(row.task_id) ?? []), row]); if (!tasks.has(row.task_id)) review('unresolved_deadline_task', 'Deadline change references an unknown task.', { task_id: row.task_id }); }
  for (const row of input.completion_reviews) { completion.set(row.task_id, [...(completion.get(row.task_id) ?? []), row]); if (!tasks.has(row.task_id)) review('unresolved_review_task', 'Completion review references an unknown task.', { task_id: row.task_id }); }
  const dueInstant = (value: string | null, employeeId: string | null): number | null => {
    if (dateValid(value)) {
      const hours = employeeId ? capacity.get(employeeId) : null;
      if (hours?.start == null || hours.end == null || hours.end <= hours.start) return null;
      const end = hours.end;
      const hh = String(Math.floor(end / 60)).padStart(2, '0'), mm = String(end % 60).padStart(2, '0');
      return instant(`${value}T${hh}:${mm}:00+03:00`);
    }
    return instant(value);
  };
  const task_tracking: DailyTaskTracking[] = [];
  for (const task of [...input.tasks].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const refs = { task_id: task.id, ...(task.assigned_employee_id ? { employee_id: task.assigned_employee_id } : {}) };
    const employee = task.assigned_employee_id ? employees.get(task.assigned_employee_id) : undefined;
    if (!employee) review('unresolved_task_employee', 'Task assignment is missing or outside the employee snapshot.', refs);
    let deadline = task.due_date;
    const changes = revisions.get(task.id) ?? [];
    let blockedDeadline = false;
    if (changes.length > 1 || (changes.length === 1 && (!approvalValid(changes[0].approval) || changes[0].previous_due_date !== task.due_date || dueInstant(changes[0].new_due_date, task.assigned_employee_id) === null))) {
      blockedDeadline = true; review('deadline_change_requires_review', 'Reconcile the approved deadline revision before reminders or timeliness calculations.', refs);
    } else if (changes.length === 1) deadline = changes[0].new_due_date;
    const savedDeadline = record(task.metadata) ? task.metadata.deadline_at : null;
    const frozenDeadline = changes.length === 0 && dateValid(deadline) && typeof savedDeadline === 'string';
    const savedInstant = frozenDeadline ? instant(savedDeadline) : null;
    const invalidSavedDeadline = frozenDeadline && (savedInstant === null || dateInTimeZone(savedDeadline) !== deadline);
    if (invalidSavedDeadline) review('stored_deadline_requires_review', 'The stored deadline timestamp conflicts with the task calendar date.', refs);
    const due = blockedDeadline || invalidSavedDeadline ? null : frozenDeadline ? savedInstant : dueInstant(deadline, task.assigned_employee_id);
    if (due === null && !cancelled(task.status)) review('unknown_deadline', 'No trustworthy deadline is available; overdue and on-time status remain unknown.', refs);
    const completedAt = task.completed_at ? instant(task.completed_at) : null;
    const created = instant(task.created_at), started = task.started_at ? instant(task.started_at) : null;
    const validCompleted = completedAt !== null && completedAt <= now && created !== null && created <= completedAt;
    const invalidLifecycle = created === null || created > now || !!(task.started_at && (started === null || started > now || (created !== null && started < created) || (validCompleted && started > completedAt!)));
    const contradictory = !!task.completed_at && !validCompleted;
    if (contradictory || invalidLifecycle) review('invalid_task_timestamps', 'Recorded task timestamps require human review.', refs);
    const knownStatus = open(task.status) || terminal(task.status) || cancelled(task.status);
    if (!knownStatus) review('unknown_task_status', 'Task status is unrecognized; no reminder or completion inference is made.', refs);
    const claimed = cancelled(task.status) ? false : contradictory || invalidLifecycle || !knownStatus ? null : terminal(task.status) || validCompleted;
    if (open(task.status) && validCompleted) review('completion_status_conflict', 'A completion timestamp conflicts with an open status; suppress reminders until reviewed.', refs);
    const reviews = completion.get(task.id) ?? [];
    let evidence: DailyTaskTracking['evidence_status'] = 'unknown';
    let supervisor: DailyTaskTracking['supervisor_status'] = 'unknown'; let approvedAt: number | null = null;
    if (reviews.length === 1 && ['unknown', 'submitted', 'verified', 'rejected'].includes(reviews[0].evidence_status) && ['pending', 'approved', 'rejected'].includes(reviews[0].supervisor_status)) {
      const r = reviews[0];
      const verified = approvalValid(r.approval) && r.approval!.approved_by_employee_id !== task.assigned_employee_id;
      evidence = ['verified', 'rejected'].includes(r.evidence_status) && !verified ? 'unknown' : r.evidence_status;
      supervisor = r.supervisor_status === 'pending' ? 'pending' : verified ? r.supervisor_status : 'unknown';
      if (supervisor === 'approved') {
        approvedAt = instant(r.approval!.approved_at);
        if (claimed !== true || !validCompleted || approvedAt! < completedAt!) { supervisor = 'unknown'; approvedAt = null; review('approval_completion_conflict', 'Approval must follow a documented completion claim.', refs); }
      }
      if (!verified && (r.supervisor_status !== 'pending' || ['verified', 'rejected'].includes(r.evidence_status))) review('unverified_completion_review', 'Evidence or supervisor approval needs an authorized human reviewer.', refs);
    } else if (reviews.length) review('completion_review_requires_reconciliation', 'Reconcile ambiguous completion review records.', refs);
    const isCancelled = cancelled(task.status);
    const overdue = isCancelled || claimed === true ? false : claimed === null || due === null ? null : due < now;
    const state = isCancelled ? 'cancelled' : claimed === null ? 'unknown' : claimed ? supervisor === 'approved' ? 'approved' : 'awaiting_human_review' : 'open';
    const tracking: DailyTaskTracking = {
      task_id: task.id, employee_id: task.assigned_employee_id, state,
      effective_due_at: due === null ? null : new Date(due).toISOString(), claimed_complete: claimed,
      claimed_completed_at: claimed === true && validCompleted ? new Date(completedAt!).toISOString() : null,
      evidence_status: evidence, supervisor_status: supervisor, approved_at: approvedAt === null ? null : new Date(approvedAt).toISOString(),
      overdue_open: overdue, claimed_on_time: claimed === true && validCompleted && due !== null ? completedAt! <= due : null,
      approved_on_time: !isCancelled && approvedAt !== null && due !== null ? approvedAt <= due : null,
      documented_elapsed_minutes: claimed === true && validCompleted && started !== null && created !== null && started >= created && started <= completedAt! ? (completedAt! - started) / 60_000 : null,
      quality_score: null,
    };
    task_tracking.push(tracking);
    if (employee && !isCancelled) {
      const cap = capacity.get(employee.id)!;
      if (claimed === true) {
        if (!validCompleted) cap.consumed = null;
        else if (dateInTimeZone(new Date(completedAt!).toISOString()) === today) {
          // A documented effort figure takes precedence; otherwise reserve the approved
          // estimate conservatively. Elapsed wall-clock time is not active work time.
          const effort = task.actual_time_minutes == null ? task.estimated_time_minutes : task.actual_time_minutes;
          if (!integer(effort, 1, 1440)) cap.consumed = null;
          else if (cap.consumed !== null) cap.consumed += effort;
        }
      } else if (due === null || claimed === null) { cap.reserved = null; cap.consumed = null; }
      else if (dateInTimeZone(new Date(due).toISOString()) <= today || task.status === 'in_progress' || started !== null) {
        if (!integer(task.estimated_time_minutes, 1, 1440) || (task.actual_time_minutes != null && !integer(task.actual_time_minutes, 0, 1440))) cap.reserved = null;
        else if (cap.reserved !== null) cap.reserved += Math.max(task.estimated_time_minutes, task.actual_time_minutes ?? 0);
      }
    }
  }
  const existingKeys = new Set(input.tasks.map(task => task.dedupe_key).filter((v): v is string => !!v));
  const semantic = new Set<string>(); const existingAssignments = new Map<string, Set<string>>(); const ambiguousSources = new Set<string>();
  for (const task of input.tasks) {
    const metadata = record(task.metadata) ? task.metadata : {};
    const sourceKind = metadata.source_kind === 'schedule' ? 'schedule' : 'plan';
    const sourceId = sourceKind === 'schedule' ? metadata.source_id : metadata.source_plan_id;
    if (!id(sourceId)) continue;
    const occurrence = dateValid(metadata.occurrence_date) ? metadata.occurrence_date : dateValid(metadata.local_date) ? metadata.local_date : dateValid(task.due_date) ? task.due_date : null;
    if (!occurrence || !task.assigned_employee_id) { ambiguousSources.add(key(sourceKind, sourceId)); continue; }
    const template = id(metadata.template_id) ? metadata.template_id : '*';
    semantic.add(key(sourceKind, sourceId, task.assigned_employee_id, occurrence, template));
    const occurrenceKey = key(sourceKind, sourceId, occurrence, template);
    existingAssignments.set(occurrenceKey, new Set([...(existingAssignments.get(occurrenceKey) ?? []), task.assigned_employee_id]));
  }
  const addCandidate = (candidate: Omit<DailyTaskDraft, 'due_date' | 'estimated_time_minutes' | 'user_id'>, estimate: number | null) => {
    const employee = employees.get(candidate.assigned_employee_id); const source_id = candidate.metadata.source_id;
    if (!employee) { review('unresolved_responsibility', 'Resolve the explicitly responsible employee within this organization.', { source_id }); return; }
    if (!id(employee.user_id)) { review('employee_account_required', 'The responsible employee needs a verified linked user account before task creation.', { source_id, employee_id: employee.id }); return; }
    if (ambiguousSources.has(key(candidate.metadata.source_kind, source_id))) { review('ambiguous_existing_occurrence', 'An existing source task has no stable occurrence identity; reconcile it before regeneration.', { source_id, employee_id: employee.id }); return; }
    const covered = (template: string) => semantic.has(key(candidate.metadata.source_kind, source_id, employee.id, today, template));
    const legacyKey = candidate.metadata.source_kind === 'plan' ? deterministicPreviewId(input.organization_id, source_id, today, candidate.metadata.template_id) : null;
    if (existingKeys.has(candidate.dedupe_key) || (legacyKey !== null && existingKeys.has(legacyKey)) || covered(candidate.metadata.template_id) || covered('*')) { skipped.push({ source_id, employee_id: employee.id, reason: 'existing_occurrence_including_completed_or_cancelled' }); return; }
    if (candidate.metadata.source_kind === 'plan' && [candidate.metadata.template_id, '*'].some(template => [...(existingAssignments.get(key('plan', source_id, today, template)) ?? [])].some(assigned => assigned !== employee.id))) { review('existing_assignment_requires_review', 'This plan occurrence is already assigned to another employee; do not create a second assignment.', { source_id, employee_id: employee.id }); return; }
    if (unavailable.has(employee.id)) { skipped.push({ source_id, employee_id: employee.id, reason: 'employee_unavailable' }); return; }
    const cap = capacity.get(employee.id)!;
    if (cap.total === null || cap.reserved === null || cap.consumed === null || !integer(estimate, 1, 1440)) { review('capacity_requires_review', 'Task duration, capacity or current workload is unknown; do not treat it as zero.', { source_id, employee_id: employee.id }); return; }
    if (cap.reserved + cap.consumed + cap.planned + estimate > cap.total || cap.reserved + cap.planned + estimate > Math.max(0, cap.end! - Math.max(cap.start!, localMinute))) { review('workload_capacity_exceeded', 'The explicit daily capacity would be exceeded; human prioritization is required.', { source_id, employee_id: employee.id }); return; }
    if (!ready || !workingDay || localMinute < 480) return;
    if (task_drafts.length + notification_drafts.length >= DAILY_LIMITS.drafts) fail('draft_limit', 'The maximum draft fanout was exceeded; no partial result is returned.');
    const hh = String(Math.floor(cap.end! / 60)).padStart(2, '0'), mm = String(cap.end! % 60).padStart(2, '0');
    task_drafts.push({ ...candidate, user_id: employee.user_id, due_date: today, estimated_time_minutes: estimate, metadata: { ...candidate.metadata, deadline_at: `${today}T${hh}:${mm}:00+03:00` } });
    cap.planned += estimate; existingKeys.add(candidate.dedupe_key);
  };
  for (const wrapper of [...input.plans].sort((a, b) => a.plan.id.localeCompare(b.plan.id, 'en'))) {
    const p = wrapper.plan;
    if (terminal(p.status ?? '') || cancelled(p.status ?? '')) { skipped.push({ source_id: p.id, reason: 'completed_or_cancelled_plan' }); continue; }
    if (!approvalValid(wrapper.approval)) { review('source_approval_required', 'The source plan needs verified approval.', { source_id: p.id }); continue; }
    // Reuse rule-plans target allocation and narrow templates; never reinterpret free text.
    if (typeof p.activity_name !== 'string' || !p.activity_name.trim() || p.activity_name.length > 500) { review('invalid_plan_title', 'A bounded explicit activity name is required.', { source_id: p.id }); continue; }
    const preview = previewTasks({ organization_id: input.organization_id, year: Number(today.slice(0, 4)), months: [Number(today.slice(5, 7))], plans: [p], calendar: wrapper.allocation_calendar });
    for (const issue of preview.needs_review) review(issue.code, issue.message, { source_id: p.id });
    for (const task of preview.tasks.filter(task => task.due_date === today)) {
      if (!workingDay) { review('plan_calendar_exception', 'Today was allocated in the approved plan but is now a non-working date; review the target instead of redistributing it.', { source_id: p.id }); continue; }
      addCandidate({ dedupe_key: dailyTaskKey(input.organization_id, 'plan', p.id, task.assigned_employee_id, today, task.template_id), organization_id: input.organization_id,
        assigned_employee_id: task.assigned_employee_id, title: task.title, description: task.description, status: 'upcoming', priority: 'medium', ai_generated: false,
        source: 'rules_daily_preview', source_activity_id: null, executive_plan_id: null, phase: 'during',
        metadata: { rule_version: DAILY_RULE_VERSION, source_kind: 'plan', source_id: p.id, source_plan_id: p.id, source_month_id: typeof task.metadata.source_month_id === 'string' ? task.metadata.source_month_id : null,
          template_id: task.template_id, occurrence_date: today, local_date: today, source_approval_revision: wrapper.approval.revision, no_quality_assessment: true, target: task.target, deadline_at: null } }, wrapper.estimated_time_minutes);
    }
  }
  for (const group of [...input.schedule_groups].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    if (group.status === 'completed' || group.status === 'cancelled') { skipped.push({ source_id: group.id, reason: 'completed_or_cancelled_schedule' }); continue; }
    if (group.status !== 'active' || !approvalValid(group.approval)) { review('source_approval_required', 'The schedule group needs active status and verified approval.', { source_id: group.id }); continue; }
    const occurrence = recurrenceToday(group, today);
    if (occurrence === 'review') { review('recurrence_requires_review', 'Resolve the recurrence, period boundary or missing calendar day explicitly.', { source_id: group.id }); continue; }
    if (occurrence !== 'due') continue;
    if (!workingDay) {
      if (group.non_working_day === 'review') review('non_working_occurrence', 'Approve a replacement date or skip; occurrences are not silently shifted.', { source_id: group.id });
      else skipped.push({ source_id: group.id, reason: 'non_working_day' });
      continue;
    }
    if (!group.responsible_employee_ids.length || !group.templates.length) { review('empty_schedule', 'A schedule requires explicit responsible employees and templates.', { source_id: group.id }); continue; }
    for (const employeeId of [...group.responsible_employee_ids].sort()) for (const template of [...group.templates].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
      if (!id(employeeId) || typeof template.title !== 'string' || !template.title.trim() || template.title.length > 500 || typeof template.description !== 'string' || template.description.length > 10_000) { review('invalid_template_or_responsibility', 'Provide a bounded explicit template and responsible employee ID.', { source_id: group.id }); continue; }
      addCandidate({ dedupe_key: dailyTaskKey(input.organization_id, 'schedule', group.id, employeeId, today, template.id), organization_id: input.organization_id,
        assigned_employee_id: employeeId, title: template.title, description: template.description, status: 'upcoming', priority: 'medium', ai_generated: false,
        source: 'rules_daily_preview', source_activity_id: null, executive_plan_id: null, phase: 'during',
        metadata: { rule_version: DAILY_RULE_VERSION, source_kind: 'schedule', source_id: group.id, source_plan_id: null, source_month_id: null, template_id: template.id,
          occurrence_date: today, local_date: today, source_approval_revision: group.approval.revision, no_quality_assessment: true, target: null, deadline_at: null } }, template.estimated_time_minutes);
    }
  }
  const notified = new Set(input.notification_receipts.map(receipt => receipt.dedupe_key));
  for (const receipt of input.notification_receipts) {
    if (!id(receipt.task_id) || !id(receipt.employee_id) || !dateValid(receipt.local_date) || receipt.dedupe_key !== dailyNotificationKey(input.organization_id, receipt.task_id, receipt.employee_id, receipt.local_date)) fail('invalid_notification_receipt', 'Reconcile notification ledger identities before planning.');
  }
  for (const tracking of task_tracking) {
    if (tracking.overdue_open !== true || !tracking.employee_id || !ready || !workingDay || unavailable.has(tracking.employee_id)) continue;
    const sourceTask = tasks.get(tracking.task_id)!;
    if (typeof sourceTask.title !== 'string' || !sourceTask.title.trim() || sourceTask.title.length > 500) { review('invalid_task_title', 'A bounded task title is required for an in-app reminder.', { task_id: tracking.task_id }); continue; }
    const employee = employees.get(tracking.employee_id); const cap = capacity.get(tracking.employee_id);
    if (employee && !id(employee.user_id)) { review('notification_recipient_unavailable', 'A linked employee user account is required for the in-app notification.', { task_id: tracking.task_id, employee_id: employee.id }); continue; }
    if (!employee || !id(employee.user_id) || cap?.start == null || cap.end == null || cap.end <= cap.start || localMinute < cap.start || localMinute >= cap.end) continue;
    const dedupe_key = dailyNotificationKey(input.organization_id, tracking.task_id, tracking.employee_id, today);
    if (notified.has(dedupe_key)) continue;
    if (task_drafts.length + notification_drafts.length >= DAILY_LIMITS.drafts) fail('draft_limit', 'The maximum draft fanout was exceeded; no partial result is returned.');
    notification_drafts.push({ dedupe_key, organization_id: input.organization_id, employee_id: tracking.employee_id, user_id: employee.user_id, task_id: tracking.task_id,
      channel: 'in_app', kind: 'task_overdue', local_date: today, effective_due_at: tracking.effective_due_at!, title: 'مهمة تجاوزت الموعد المسجل',
      message: `تجاوزت المهمة «${tasks.get(tracking.task_id)!.title}» موعدها المسجل. يرجى تحديث حالتها أو طلب مراجعة الموعد.` });
    notified.add(dedupe_key);
  }
  const employee_tracking: DailyEmployeeTracking[] = [...input.employees].sort((a, b) => a.id.localeCompare(b.id, 'en')).map(employee => {
    const rows = task_tracking.filter(task => task.employee_id === employee.id && task.state !== 'cancelled');
    const count = (predicate: (task: DailyTaskTracking) => boolean) => input.snapshot_complete ? rows.filter(predicate).length : null;
    const isToday = (value: string | null) => value !== null && dateInTimeZone(value) === today;
    const cap = capacity.get(employee.id)!;
    return { employee_id: employee.id, local_date: today, data_status: input.snapshot_complete ? 'complete' : 'unknown',
      tasks_due_today: count(task => isToday(task.effective_due_at)), claimed_completed_today: count(task => isToday(task.claimed_completed_at)),
      supervisor_approved_today: count(task => isToday(task.approved_at)), overdue_open: count(task => task.overdue_open === true),
      completion_review_unknown: count(task => task.claimed_complete === true && task.supervisor_status === 'unknown'), unknown_deadlines: count(task => task.effective_due_at === null),
      capacity_minutes: cap.total, reserved_minutes: input.snapshot_complete ? cap.reserved : null, completed_capacity_minutes: input.snapshot_complete ? cap.consumed : null, planned_minutes: cap.planned, quality_score: null, rank: null };
  });
  return {
    rule_version: DAILY_RULE_VERSION, mode: 'rules' as const, preview_only: true as const, requires_confirmation: true as const,
    organization_id: input.organization_id, as_of: new Date(now).toISOString(), local_date: today, timezone: 'Asia/Riyadh' as const,
    task_drafts, notification_drafts, task_tracking, employee_tracking, needs_review, skipped,
    writes_performed: 0 as const, notifications_sent: 0 as const, external_calls: 0 as const,
    evaluation_policy: { weights_changed: false as const, ai_usage_weight_changed: false as const, quality_assessment: 'human_rubric_required' as const, high_impact_ranking: false as const },
    job_proposal: { local_time: '08:00', timezone: 'Asia/Riyadh', installed: false as const, cron_created: false as const, missed_days: 'explicit_review_no_backfill' as const },
  };
}
