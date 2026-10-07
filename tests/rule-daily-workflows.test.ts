import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_LIMITS, DailyRuleError, dailyNotificationKey, dailyTaskKey, planDailyWorkflows } from '../supabase/functions/_shared/rule-daily-workflows.ts';
import type { ApprovedDailyPlan, ApprovedScheduleGroup, DailyApproval, DailyEmployee, DailyExistingTask, DailyLeave, DailyWorkflowInput } from '../supabase/functions/_shared/rule-daily-workflows.ts';

const calendar: DailyWorkflowInput['calendar'] = { timezone: 'Asia/Riyadh', weekend_days: [5, 6], excluded_dates: [] };
const approval = (overrides: Partial<DailyApproval> = {}): DailyApproval => ({ organization_id: 'org-1', authorized: true, approved_by_employee_id: 'manager-1', approved_at: '2026-01-01T00:00:00Z', revision: 'approved-1', ...overrides });
const employee = (overrides: Partial<DailyEmployee> = {}): DailyEmployee => ({ id: 'employee-1', organization_id: 'org-1', user_id: 'user-1', status: 'active', is_viewer_account: false, work_start_time: '08:00:00', work_end_time: '16:00:00', daily_capacity_minutes: 480, ...overrides });
const schedule = (overrides: Partial<ApprovedScheduleGroup> = {}): ApprovedScheduleGroup => ({ id: 'schedule-1', organization_id: 'org-1', approval: approval(), status: 'active', responsible_employee_ids: ['employee-1'], start_date: '2026-01-01', end_date: null, recurrence: { frequency: 'daily', interval: 1 }, non_working_day: 'skip', templates: [{ id: 'template-1', title: 'إعداد تقرير المتابعة', description: 'وصف العمل المعتمد كما هو.', estimated_time_minutes: 60 }], ...overrides });
const plan = (overrides: Partial<ApprovedDailyPlan> = {}): ApprovedDailyPlan => ({ plan: { id: 'plan-1', organization_id: 'org-1', activity_name: 'نشر محتوى', year: 2026, responsible_employee_id: 'employee-1', annual_target: 210, months: [{ id: 'month-10', month: 10, monthly_target: 21 }] }, approval: approval(), allocation_calendar: calendar, estimated_time_minutes: 30, ...overrides });
const task = (overrides: Partial<DailyExistingTask> = {}): DailyExistingTask => ({ id: 'task-1', organization_id: 'org-1', assigned_employee_id: 'employee-1', title: 'مهمة مسجلة', status: 'in_progress', due_date: '2026-10-06', created_at: '2026-10-01T06:00:00Z', started_at: '2026-10-06T06:00:00Z', completed_at: null, estimated_time_minutes: 60, ...overrides });
const leave = (overrides: Partial<DailyLeave> = {}): DailyLeave => ({ id: 'leave-1', organization_id: 'org-1', employee_id: 'employee-1', start_date: '2026-10-07', end_date: '2026-10-07', status: 'approved', approval: approval(), ...overrides });
const input = (overrides: Partial<DailyWorkflowInput> = {}): DailyWorkflowInput => ({ organization_id: 'org-1', authorization: { organization_id: 'org-1', actor_user_id: 'actor-1', authorized: true }, now: '2026-10-07T06:00:00Z', calendar, snapshot_complete: true, employees: [employee(), employee({ id: 'manager-1', user_id: 'manager-user' })], plans: [], schedule_groups: [schedule()], tasks: [], leave: [], completion_reviews: [], deadline_changes: [], notification_receipts: [], leave_policy: { approved_leave: 'skip', pending_leave: 'review', suppress_notifications: true }, ...overrides });
const employeeMetrics = (result: ReturnType<typeof planDailyWorkflows>) => result.employee_tracking.find(row => row.employee_id === 'employee-1')!;
const hasReview = (result: ReturnType<typeof planDailyWorkflows>, code: string) => result.needs_review.some(row => row.code === code);
const persist = (draft: ReturnType<typeof planDailyWorkflows>['task_drafts'][number], overrides: Partial<DailyExistingTask> = {}): DailyExistingTask => task({ ...draft, id: 'persisted-1', ...overrides });

test('pure daily schedule proposal is stable, bounded, schema-shaped, and has no scoring or effects', () => {
  const fixture = input(); const original = structuredClone(fixture);
  const result = planDailyWorkflows(fixture);
  assert.deepEqual(fixture, original);
  assert.deepEqual(result, planDailyWorkflows(structuredClone(fixture)));
  assert.equal(result.task_drafts.length, 1);
  const draft = result.task_drafts[0];
  assert.equal(draft.assigned_employee_id, 'employee-1');
  assert.equal(draft.status, 'upcoming');
  assert.equal(draft.due_date, '2026-10-07');
  assert.equal(draft.metadata.deadline_at, '2026-10-07T16:00:00+03:00');
  assert.equal(draft.user_id, 'user-1');
  assert.equal(draft.estimated_time_minutes, 60);
  assert.equal(draft.ai_generated, false);
  assert.equal(draft.metadata.no_quality_assessment, true);
  assert.equal(draft.metadata.target, null);
  assert.equal(result.writes_performed + result.notifications_sent + result.external_calls, 0);
  assert.equal(result.job_proposal.installed, false);
  assert.equal(result.job_proposal.local_time, '08:00');
  assert.equal(result.evaluation_policy.weights_changed, false);
  assert.equal(result.evaluation_policy.ai_usage_weight_changed, false);
  assert.ok(result.employee_tracking.every(row => row.quality_score === null && row.rank === null));
  assert.equal(result.needs_review.length, 0);
});

test('repeated runs and revised approvals never recreate an existing occurrence of any lifecycle status', () => {
  const initial = planDailyWorkflows(input()).task_drafts[0];
  for (const status of ['upcoming', 'in_progress', 'completed', 'cancelled', 'executed']) {
    const result = planDailyWorkflows(input({ schedule_groups: [schedule({ approval: approval({ revision: 'approved-v2' }) })], tasks: [persist(initial, { status })] }));
    assert.equal(result.task_drafts.length, 0, status);
    assert.ok(result.skipped.some(row => row.reason === 'existing_occurrence_including_completed_or_cancelled'));
  }
});

test('semantic identity preserves a completed occurrence with no dedupe key, including extended deadline', () => {
  const initial = planDailyWorkflows(input()).task_drafts[0];
  const old = persist(initial, { dedupe_key: null, due_date: '2026-10-14T16:00:00+03:00', status: 'completed' });
  assert.equal(planDailyWorkflows(input({ tasks: [old] })).task_drafts.length, 0);
});

test('stable identities escape separators and distinguish employee, occurrence, source and organization', () => {
  assert.notEqual(dailyTaskKey('a:b', 'plan', 'c', 'd', 'e', 'f'), dailyTaskKey('a', 'plan', 'b:c', 'd', 'e', 'f'));
  assert.notEqual(dailyTaskKey('o', 'plan', 'p', 'e1', 'd', 't'), dailyTaskKey('o', 'plan', 'p', 'e2', 'd', 't'));
  assert.notEqual(dailyTaskKey('o', 'plan', 'p', 'e', 'd', 't'), dailyTaskKey('o', 'schedule', 'p', 'e', 'd', 't'));
  assert.notEqual(dailyNotificationKey('o', 't', 'e', 'd1'), dailyNotificationKey('o', 't', 'e', 'd2'));
});

test('Saudi local day is derived from supplied offset and never the machine clock', () => {
  const midnight = planDailyWorkflows(input({ now: '2026-10-06T21:05:00Z' }));
  assert.equal(midnight.local_date, '2026-10-07');
  assert.equal(midnight.task_drafts.length, 0, 'job proposal is not due before 08:00 local');
  const eight = planDailyWorkflows(input({ now: '2026-10-07T08:00:00+03:00' }));
  assert.equal(eight.task_drafts.length, 1);
  assert.deepEqual(eight, planDailyWorkflows(input({ now: '2026-10-07T05:00:00Z' })));
});

test('invalid, offsetless and impossible clocks fail closed', () => {
  for (const now of ['2026-10-07', '2026-10-07T09:00:00', '2026-02-30T06:00:00Z', '2026-10-07T24:00:00Z', 'invalid']) {
    assert.throws(() => planDailyWorkflows(input({ now })), { code: 'invalid_clock' });
  }
  assert.throws(() => planDailyWorkflows(input({ calendar: { ...calendar, excluded_dates: ['2026-02-30'] } })), { code: 'invalid_calendar' });
});

test('daily interval uses calendar days anchored at the approved start, with no backfill', () => {
  const group = schedule({ start_date: '2026-10-05', recurrence: { frequency: 'daily', interval: 2 } });
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group] })).task_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2026-10-08T06:00:00Z' })).task_drafts.length, 0);
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2026-10-11T06:00:00Z' })).task_drafts.length, 1);
  const later = planDailyWorkflows(input({ schedule_groups: [group], now: '2026-10-11T06:00:00Z' }));
  assert.ok(later.task_drafts.every(row => row.metadata.occurrence_date === '2026-10-11'));
});

test('weekly intervals use Sunday weeks and explicit weekdays across month/year boundaries', () => {
  const group = schedule({ start_date: '2026-12-30', recurrence: { frequency: 'weekly', interval: 2, weekdays: [0, 3] } });
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2026-12-30T06:00:00Z' })).task_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2027-01-03T06:00:00Z' })).task_drafts.length, 0);
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2027-01-10T06:00:00Z' })).task_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2027-01-11T06:00:00Z' })).task_drafts.length, 0);
});

test('monthly missing days are explicitly skipped or reviewed, never clamped to month end', () => {
  for (const missing_day of ['skip', 'review'] as const) {
    const group = schedule({ start_date: '2026-01-31', recurrence: { frequency: 'monthly', interval: 1, day_of_month: 31, missing_day } });
    const february = planDailyWorkflows(input({ schedule_groups: [group], now: '2026-02-28T06:00:00Z', calendar: { ...calendar, weekend_days: [] } }));
    assert.equal(february.task_drafts.length, 0);
    assert.equal(hasReview(february, 'recurrence_requires_review'), missing_day === 'review');
    assert.equal(planDailyWorkflows(input({ schedule_groups: [group], now: '2026-03-31T06:00:00Z' })).task_drafts.length, 1);
  }
});

test('monthly interval and leap day are deterministic', () => {
  const group = schedule({ start_date: '2024-01-29', approval: approval({ approved_at: '2024-01-01T00:00:00Z' }), recurrence: { frequency: 'monthly', interval: 1, day_of_month: 29, missing_day: 'skip' } });
  assert.equal(planDailyWorkflows(input({ now: '2024-02-29T06:00:00Z', schedule_groups: [group] })).task_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ now: '2025-02-28T06:00:00Z', schedule_groups: [group] })).task_drafts.length, 0);
  const bimonthly = schedule({ start_date: '2026-08-07', recurrence: { frequency: 'monthly', interval: 2, day_of_month: 7, missing_day: 'skip' } });
  assert.equal(planDailyWorkflows(input({ schedule_groups: [bimonthly] })).task_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ now: '2026-11-07T06:00:00Z', calendar: { ...calendar, weekend_days: [] }, schedule_groups: [bimonthly] })).task_drafts.length, 0);
});

test('inactive dates, end dates and completed/cancelled groups are excluded', () => {
  for (const group of [schedule({ start_date: '2026-10-08' }), schedule({ end_date: '2026-10-06' }), schedule({ status: 'completed' }), schedule({ status: 'cancelled' })]) {
    assert.equal(planDailyWorkflows(input({ schedule_groups: [group] })).task_drafts.length, 0);
  }
  assert.equal(planDailyWorkflows(input({ schedule_groups: [schedule({ end_date: '2026-10-07' })] })).task_drafts.length, 1);
});

test('holidays/weekends suppress work and reminders with explicit review or skip behavior', () => {
  for (const non_working_day of ['skip', 'review'] as const) {
    const result = planDailyWorkflows(input({ tasks: [task()], calendar: { ...calendar, excluded_dates: ['2026-10-07'] }, schedule_groups: [schedule({ non_working_day })] }));
    assert.equal(result.task_drafts.length, 0); assert.equal(result.notification_drafts.length, 0);
    assert.equal(hasReview(result, 'non_working_occurrence'), non_working_day === 'review');
  }
  assert.equal(planDailyWorkflows(input({ now: '2026-10-09T06:00:00Z' })).task_drafts.length, 0);
});

test('approved leave uses inclusive dates and blocks assignment and reminders', () => {
  const result = planDailyWorkflows(input({ tasks: [task()], leave: [leave()] }));
  assert.equal(result.task_drafts.length, 0); assert.equal(result.notification_drafts.length, 0);
  assert.equal(result.task_tracking[0].overdue_open, true, 'objective deadline observation is retained, without messaging on leave');
  assert.equal(planDailyWorkflows(input({ leave: [leave({ end_date: '2026-10-06', start_date: '2026-10-01' })] })).task_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ leave: [leave({ start_date: '2026-10-08', end_date: '2026-10-08' })] })).task_drafts.length, 1);
});

test('pending/unverified leave and absent leave policy never become a silent zero or permission', () => {
  for (const record of [leave({ status: 'pending', approval: null }), leave({ approval: null }), leave({ start_date: '2026-13-01' })]) {
    const result = planDailyWorkflows(input({ leave: [record], tasks: [task()] }));
    assert.equal(result.task_drafts.length, 0); assert.equal(result.notification_drafts.length, 0); assert.ok(result.needs_review.length > 0);
  }
  const noPolicy = planDailyWorkflows(input({ leave_policy: null, tasks: [task()] }));
  assert.equal(noPolicy.task_drafts.length, 0); assert.equal(noPolicy.notification_drafts.length, 0); assert.ok(hasReview(noPolicy, 'leave_policy_required'));
  const reviewLeave = planDailyWorkflows(input({ leave: [leave()], leave_policy: { approved_leave: 'review', pending_leave: 'review', suppress_notifications: true } }));
  assert.ok(hasReview(reviewLeave, 'approved_leave_reschedule_review'));
});

test('rejected and cancelled leave does not block approved work', () => {
  for (const status of ['rejected', 'cancelled'] as const) assert.equal(planDailyWorkflows(input({ leave: [leave({ status, approval: null })] })).task_drafts.length, 1);
});

test('inactive, viewer and on-leave employees are never substituted or assigned work', () => {
  for (const patch of [{ status: 'inactive' }, { status: 'on_leave' }, { is_viewer_account: true }, { status: null }]) {
    const result = planDailyWorkflows(input({ employees: [employee(patch), employee({ id: 'manager-1' })], tasks: [task()] }));
    assert.equal(result.task_drafts.length, 0); assert.equal(result.notification_drafts.length, 0);
  }
  const absent = planDailyWorkflows(input({ schedule_groups: [schedule({ responsible_employee_ids: ['not-in-org'] })] }));
  assert.equal(absent.task_drafts.length, 0); assert.ok(hasReview(absent, 'unresolved_responsibility'));
});

test('capacity conservatively reserves open overdue/today work and never treats unknown duration as zero', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ estimated_time_minutes: 400 })] }));
  assert.equal(result.task_drafts.length, 0); assert.ok(hasReview(result, 'workload_capacity_exceeded'));
  assert.equal(employeeMetrics(result).reserved_minutes, 400);
  const unknown = planDailyWorkflows(input({ tasks: [task({ estimated_time_minutes: null })] }));
  assert.equal(unknown.task_drafts.length, 0); assert.equal(employeeMetrics(unknown).reserved_minutes, null);
  assert.ok(hasReview(unknown, 'capacity_requires_review'));
  assert.equal(planDailyWorkflows(input({ tasks: [task({ status: 'upcoming', started_at: null, estimated_time_minutes: 480, due_date: '2026-10-08' })] })).task_drafts.length, 1);
});

test('capacity accounts for all proposed templates deterministically and late runs cannot create already-due work', () => {
  const templates = ['c', 'b', 'a'].map(id => ({ id, title: id, description: '', estimated_time_minutes: 60 }));
  const result = planDailyWorkflows(input({ employees: [employee({ daily_capacity_minutes: 120 }), employee({ id: 'manager-1' })], schedule_groups: [schedule({ templates })] }));
  assert.deepEqual(result.task_drafts.map(row => row.metadata.template_id), ['a', 'b']);
  assert.equal(employeeMetrics(result).planned_minutes, 120); assert.ok(hasReview(result, 'workload_capacity_exceeded'));
  assert.equal(planDailyWorkflows(input({ now: '2026-10-07T12:30:00Z' })).task_drafts.length, 0, 'only 30 work minutes remain');
  assert.equal(planDailyWorkflows(input({ now: '2026-10-07T13:00:00Z' })).task_drafts.length, 0, 'workday ended');
});

test('missing hours, invalid capacities, overnight shifts and ambiguous deadlines require review', () => {
  for (const patch of [{ work_end_time: null }, { work_start_time: '23:00', work_end_time: '07:00' }, { daily_capacity_minutes: null }, { daily_capacity_minutes: 481 }]) {
    const result = planDailyWorkflows(input({ employees: [employee(patch), employee({ id: 'manager-1' })] }));
    assert.equal(result.task_drafts.length, 0); assert.ok(hasReview(result, 'working_hours_or_capacity_required'));
  }
  const result = planDailyWorkflows(input({ tasks: [task({ due_date: null })] }));
  assert.equal(result.task_tracking[0].overdue_open, null); assert.equal(result.notification_drafts.length, 0); assert.equal(employeeMetrics(result).unknown_deadlines, 1);
});

test('overdue reminders are in-app only, respect exact due instants, and are once per employee/task/local day', () => {
  const result = planDailyWorkflows(input({ tasks: [task()], schedule_groups: [] }));
  assert.equal(result.notification_drafts.length, 1);
  assert.equal(result.notification_drafts[0].channel, 'in_app');
  assert.equal(result.notification_drafts[0].effective_due_at, '2026-10-06T13:00:00.000Z');
  const receipt = result.notification_drafts[0];
  assert.equal(planDailyWorkflows(input({ tasks: [task()], notification_receipts: [receipt, receipt] })).notification_drafts.length, 0);
  assert.equal(planDailyWorkflows(input({ tasks: [task()], notification_receipts: [receipt], now: '2026-10-08T06:00:00Z' })).notification_drafts.length, 1);
  assert.equal(planDailyWorkflows(input({ tasks: [task({ due_date: '2026-10-07T06:00:00Z' })] })).notification_drafts.length, 0, 'exact due instant is not yet overdue');
  assert.equal(planDailyWorkflows(input({ tasks: [task({ due_date: '2026-10-07T05:59:59Z' })] })).notification_drafts.length, 1);
});

test('date-only deadlines mean employee workday end, not midnight', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ due_date: '2026-10-07' })] }));
  assert.equal(result.task_tracking[0].effective_due_at, '2026-10-07T13:00:00.000Z');
  assert.equal(result.task_tracking[0].overdue_open, false); assert.equal(result.notification_drafts.length, 0);
});

test('approved deadline extensions suppress overdue and only notify after the new deadline', () => {
  const change = { organization_id: 'org-1', task_id: 'task-1', previous_due_date: '2026-10-06', new_due_date: '2026-10-08', approval: approval() };
  const result = planDailyWorkflows(input({ tasks: [task()], deadline_changes: [change] }));
  assert.equal(result.task_tracking[0].overdue_open, false); assert.equal(result.notification_drafts.length, 0);
  const after = planDailyWorkflows(input({ tasks: [task()], deadline_changes: [change], now: '2026-10-11T06:00:00Z' }));
  assert.equal(after.notification_drafts.length, 1);
  assert.equal(after.notification_drafts[0].effective_due_at, '2026-10-08T13:00:00.000Z');
});

test('same-day deadline change cannot produce a second overdue notification after one was recorded', () => {
  const sent = planDailyWorkflows(input({ tasks: [task()] })).notification_drafts[0];
  const result = planDailyWorkflows(input({ tasks: [task()], notification_receipts: [sent], deadline_changes: [{ organization_id: 'org-1', task_id: 'task-1', previous_due_date: '2026-10-06', new_due_date: '2026-10-07T05:30:00Z', approval: approval() }] }));
  assert.equal(result.task_tracking[0].overdue_open, true); assert.equal(result.notification_drafts.length, 0);
});

test('unapproved, conflicting, mismatched and duplicate deadline revisions suppress reminders and timeliness', () => {
  const change = { organization_id: 'org-1', task_id: 'task-1', previous_due_date: '2026-10-06', new_due_date: '2026-10-08', approval: approval() };
  for (const changes of [[{ ...change, previous_due_date: '2026-10-05' }], [{ ...change, approval: approval({ approved_at: '2026-12-01T00:00:00Z' }) }], [change, change], [{ ...change, new_due_date: '2026-02-30' }]]) {
    const result = planDailyWorkflows(input({ tasks: [task()], deadline_changes: changes }));
    assert.equal(result.notification_drafts.length, 0); assert.equal(result.task_tracking[0].overdue_open, null); assert.ok(hasReview(result, 'deadline_change_requires_review'));
  }
});

test('claimed completion and executed work are never reported as supervisor-approved or nagged as overdue', () => {
  for (const status of ['completed', 'executed']) {
    const result = planDailyWorkflows(input({ tasks: [task({ status, completed_at: '2026-10-07T05:00:00Z' })] }));
    const row = result.task_tracking[0];
    assert.equal(row.claimed_complete, true); assert.equal(row.state, 'awaiting_human_review');
    assert.equal(row.supervisor_status, 'unknown'); assert.equal(row.evidence_status, 'unknown'); assert.equal(row.quality_score, null);
    assert.equal(result.notification_drafts.length, 0); assert.equal(employeeMetrics(result).claimed_completed_today, 1);
    assert.equal(employeeMetrics(result).supervisor_approved_today, 0); assert.equal(employeeMetrics(result).completion_review_unknown, 1);
  }
});

test('status-only completion has unknown timing and percentages never imply evidence quality', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed' })] }));
  assert.equal(result.task_tracking[0].claimed_complete, true); assert.equal(result.task_tracking[0].claimed_on_time, null);
  assert.equal(result.task_tracking[0].documented_elapsed_minutes, null); assert.equal(employeeMetrics(result).claimed_completed_today, 0);
});

test('human approval, verified evidence and objective timestamps remain separately inspectable', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed', started_at: '2026-10-07T04:00:00Z', completed_at: '2026-10-07T05:00:00Z', due_date: '2026-10-07T05:30:00Z' })], completion_reviews: [{ organization_id: 'org-1', task_id: 'task-1', evidence_status: 'verified', supervisor_status: 'approved', approval: approval({ approved_at: '2026-10-07T05:45:00Z' }) }] }));
  const row = result.task_tracking[0];
  assert.equal(row.state, 'approved'); assert.equal(row.evidence_status, 'verified'); assert.equal(row.supervisor_status, 'approved');
  assert.equal(row.claimed_on_time, true); assert.equal(row.approved_on_time, false); assert.equal(row.documented_elapsed_minutes, 60);
  assert.equal(employeeMetrics(result).supervisor_approved_today, 1); assert.equal(row.quality_score, null);
});

test('self-approval, future or pre-completion approval and duplicate review records require human reconciliation', () => {
  const approvedReview = { organization_id: 'org-1', task_id: 'task-1', evidence_status: 'verified' as const, supervisor_status: 'approved' as const, approval: approval({ approved_at: '2026-10-07T05:30:00Z' }) };
  for (const reviews of [[{ ...approvedReview, approval: approval({ approved_by_employee_id: 'employee-1', approved_at: '2026-10-07T05:30:00Z' }) }], [{ ...approvedReview, approval: approval({ approved_at: '2026-10-08T05:30:00Z' }) }], [{ ...approvedReview, approval: approval({ approved_at: '2026-10-07T04:30:00Z' }) }], [approvedReview, approvedReview]]) {
    const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed', completed_at: '2026-10-07T05:00:00Z' })], completion_reviews: reviews }));
    assert.equal(result.task_tracking[0].supervisor_status, 'unknown'); assert.equal(result.task_tracking[0].approved_at, null); assert.ok(result.needs_review.length > 0);
  }
});

test('rejected evidence is a human status, never an invented negative quality score', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed', completed_at: '2026-10-07T05:00:00Z' })], completion_reviews: [{ organization_id: 'org-1', task_id: 'task-1', evidence_status: 'rejected', supervisor_status: 'rejected', approval: approval({ approved_at: '2026-10-07T05:30:00Z' }) }] }));
  assert.equal(result.task_tracking[0].evidence_status, 'rejected'); assert.equal(result.task_tracking[0].supervisor_status, 'rejected');
  assert.equal(result.task_tracking[0].quality_score, null); assert.equal(result.notification_drafts.length, 0);
});

test('cancelled tasks are excluded from workload, overdue and completion counters', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ status: 'cancelled', completed_at: '2026-10-07T05:00:00Z', estimated_time_minutes: 480 })] }));
  assert.equal(result.task_tracking[0].state, 'cancelled'); assert.equal(result.task_tracking[0].overdue_open, false);
  assert.equal(result.notification_drafts.length, 0); assert.equal(employeeMetrics(result).reserved_minutes, 0);
  assert.equal(employeeMetrics(result).claimed_completed_today, 0); assert.equal(result.task_drafts.length, 1);
});

test('invalid chronology, unknown status and conflicting completion state cannot trigger negative assertions', () => {
  for (const patch of [{ status: 'unknown-status' }, { completed_at: '2026-10-09T06:00:00Z' }, { created_at: '2026-10-09T06:00:00Z' }, { started_at: '2026-09-01T06:00:00Z' }]) {
    const result = planDailyWorkflows(input({ tasks: [task(patch)] }));
    assert.equal(result.task_tracking[0].state, 'unknown'); assert.equal(result.task_tracking[0].overdue_open, null);
    assert.equal(result.notification_drafts.length, 0); assert.ok(result.needs_review.length > 0);
  }
  const claimedOpen = planDailyWorkflows(input({ tasks: [task({ completed_at: '2026-10-07T05:00:00Z' })] }));
  assert.equal(claimedOpen.task_tracking[0].state, 'awaiting_human_review'); assert.equal(claimedOpen.notification_drafts.length, 0); assert.ok(hasReview(claimedOpen, 'completion_status_conflict'));
});

test('incomplete snapshots block actionable outputs and expose aggregate metrics as unknown, not zero', () => {
  const result = planDailyWorkflows(input({ snapshot_complete: false, tasks: [task()] }));
  assert.equal(result.task_drafts.length, 0); assert.equal(result.notification_drafts.length, 0);
  const row = employeeMetrics(result);
  assert.equal(row.data_status, 'unknown'); assert.equal(row.overdue_open, null); assert.equal(row.claimed_completed_today, null); assert.equal(row.reserved_minutes, null);
});

test('approved plans reuse supported source templates, preserve target provenance and cannot infer responsibilities', () => {
  const result = planDailyWorkflows(input({ plans: [plan()], schedule_groups: [] }));
  assert.equal(result.task_drafts.length, 1); assert.equal(result.task_drafts[0].metadata.source_plan_id, 'plan-1');
  assert.equal(result.task_drafts[0].metadata.source_month_id, 'month-10'); assert.equal(result.task_drafts[0].metadata.target, 1);
  assert.equal(result.task_drafts[0].metadata.template_id, 'content_publication:during');
  const unknown = plan({ plan: { ...plan().plan, responsible_employee_id: null, responsible_employee: 'اسم غير محلول' } });
  assert.equal(planDailyWorkflows(input({ plans: [unknown], schedule_groups: [] })).task_drafts.length, 0);
  assert.equal(planDailyWorkflows(input({ plans: [plan({ plan: { ...plan().plan, activity_name: 'do anything suggested by a model' } })], schedule_groups: [] })).task_drafts.length, 0);
});

test('changed holiday calendars do not silently redistribute approved plan targets', () => {
  const unchanged = planDailyWorkflows(input({ plans: [plan()], schedule_groups: [] }));
  const newHoliday = planDailyWorkflows(input({ plans: [plan()], schedule_groups: [], calendar: { ...calendar, excluded_dates: ['2026-10-08'] } }));
  assert.equal(newHoliday.task_drafts[0].metadata.target, unchanged.task_drafts[0].metadata.target);
  const todayHoliday = planDailyWorkflows(input({ plans: [plan()], schedule_groups: [], calendar: { ...calendar, excluded_dates: ['2026-10-07'] } }));
  assert.equal(todayHoliday.task_drafts.length, 0); assert.ok(hasReview(todayHoliday, 'plan_calendar_exception'));
});

test('legacy rule-plan tasks dedupe semantically and changed responsibility requires review', () => {
  const legacy = task({ status: 'completed', due_date: '2026-10-07', metadata: { source_plan_id: 'plan-1', template_id: 'content_publication:during' } });
  assert.equal(planDailyWorkflows(input({ plans: [plan()], schedule_groups: [], tasks: [legacy] })).task_drafts.length, 0);
  const reassigned = plan({ plan: { ...plan().plan, responsible_employee_id: 'manager-1' } });
  const result = planDailyWorkflows(input({ plans: [reassigned], schedule_groups: [], tasks: [legacy] }));
  assert.equal(result.task_drafts.length, 0); assert.ok(hasReview(result, 'existing_assignment_requires_review'));
});

test('ambiguous existing source occurrences and cancelled plans cannot be regenerated', () => {
  const result = planDailyWorkflows(input({ plans: [plan()], schedule_groups: [], tasks: [task({ due_date: null, metadata: { source_plan_id: 'plan-1' } })] }));
  assert.equal(result.task_drafts.length, 0); assert.ok(hasReview(result, 'ambiguous_existing_occurrence'));
  for (const status of ['completed', 'cancelled']) assert.equal(planDailyWorkflows(input({ plans: [plan({ plan: { ...plan().plan, status } })], schedule_groups: [] })).task_drafts.length, 0);
});

test('unapproved source and unresolved approval author block all source drafts', () => {
  for (const a of [approval({ approved_by_employee_id: 'foreign-manager' }), approval({ approved_at: '2027-01-01T00:00:00Z' }), approval({ revision: '' })]) {
    const result = planDailyWorkflows(input({ schedule_groups: [schedule({ approval: a })], plans: [plan({ approval: a })] }));
    assert.equal(result.task_drafts.length, 0); assert.ok(hasReview(result, 'source_approval_required'));
  }
});

test('foreign organization data or authorization fails closed across every contract', () => {
  const foreign = 'other-org';
  const fixtures = [input({ organization_id: foreign }), input({ authorization: { organization_id: foreign, actor_user_id: 'actor', authorized: true } }), input({ employees: [employee({ organization_id: foreign })] }), input({ tasks: [task({ organization_id: foreign })] }), input({ plans: [plan({ plan: { ...plan().plan, organization_id: foreign } })] }), input({ schedule_groups: [schedule({ organization_id: foreign })] }), input({ schedule_groups: [schedule({ approval: approval({ organization_id: foreign }) })] }), input({ leave: [leave({ organization_id: foreign })] }), input({ completion_reviews: [{ organization_id: foreign, task_id: 't', evidence_status: 'unknown', supervisor_status: 'pending', approval: null }] }), input({ deadline_changes: [{ organization_id: foreign, task_id: 't', previous_due_date: null, new_due_date: '2026-10-08', approval: approval() }] }), input({ notification_receipts: [{ organization_id: foreign, task_id: 't', employee_id: 'e', local_date: '2026-10-07', dedupe_key: 'key' }] })];
  for (const fixture of fixtures) assert.throws(() => planDailyWorkflows(fixture), DailyRuleError);
});

test('duplicate identities, record limits and nested fanout fail rather than return a partial plan', () => {
  assert.throws(() => planDailyWorkflows(input({ employees: [employee(), employee()] })), { code: 'duplicate_or_invalid_identity' });
  assert.throws(() => planDailyWorkflows(input({ tasks: [task(), task()] })), { code: 'duplicate_or_invalid_identity' });
  assert.throws(() => planDailyWorkflows(input({ tasks: Array.from({ length: DAILY_LIMITS.records }, (_, i) => task({ id: `task-${i}` })) })), { code: 'record_limit' });
  assert.throws(() => planDailyWorkflows(input({ schedule_groups: [schedule({ responsible_employee_ids: Array.from({ length: DAILY_LIMITS.recipients + 1 }, (_, i) => `e${i}`) })] })), { code: 'fanout_limit' });
  const templates = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, title: 't', description: '', estimated_time_minutes: 1 }));
  const groups = Array.from({ length: 6 }, (_, i) => schedule({ id: `s${i}`, templates, responsible_employee_ids: Array.from({ length: 100 }, (_, j) => `e${j}`) }));
  assert.throws(() => planDailyWorkflows(input({ schedule_groups: groups })), { code: 'fanout_limit' });
});

test('total output fanout is bounded atomically instead of dropping notifications or returning partial drafts', () => {
  const tasks = Array.from({ length: DAILY_LIMITS.drafts + 1 }, (_, i) => task({ id: `task-${i}`, estimated_time_minutes: 1 }));
  assert.throws(() => planDailyWorkflows(input({ tasks, schedule_groups: [] })), { code: 'draft_limit' });
});

test('invalid receipt keys cannot accidentally silence unrelated reminders', () => {
  assert.throws(() => planDailyWorkflows(input({ notification_receipts: [{ organization_id: 'org-1', task_id: 'task-1', employee_id: 'employee-1', local_date: '2026-10-07', dedupe_key: 'wrong' }] })), { code: 'invalid_notification_receipt' });
});

test('task and employee ordering do not change proposals or capacity decisions', () => {
  const fixture = input({ employees: [employee(), employee({ id: 'manager-1' })], tasks: [task({ id: 't2', estimated_time_minutes: 10 }), task({ id: 't1', estimated_time_minutes: 10 })], schedule_groups: [schedule({ id: 'z' }), schedule({ id: 'a' })] });
  const reversed = structuredClone(fixture); reversed.tasks.reverse(); reversed.employees.reverse(); reversed.schedule_groups.reverse();
  const result = planDailyWorkflows(fixture), other = planDailyWorkflows(reversed);
  assert.deepEqual(result.task_drafts, other.task_drafts); assert.deepEqual(result.notification_drafts, other.notification_drafts);
  assert.deepEqual(result.employee_tracking, other.employee_tracking); assert.deepEqual(result.task_tracking, other.task_tracking);
});

test('completion before start blocks supervisor approval and all timeliness assertions', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed', created_at: '2026-10-07T03:00:00Z', started_at: '2026-10-07T05:15:00Z', completed_at: '2026-10-07T05:00:00Z', due_date: '2026-10-07' })], completion_reviews: [{ organization_id: 'org-1', task_id: 'task-1', evidence_status: 'verified', supervisor_status: 'approved', approval: approval({ approved_at: '2026-10-07T05:30:00Z' }) }] }));
  assert.equal(result.task_tracking[0].state, 'unknown'); assert.equal(result.task_tracking[0].supervisor_status, 'unknown');
  assert.equal(result.task_tracking[0].approved_on_time, null); assert.equal(result.task_tracking[0].documented_elapsed_minutes, null);
  assert.equal(employeeMetrics(result).supervisor_approved_today, 0); assert.ok(hasReview(result, 'invalid_task_timestamps'));
});

test('frozen task deadlines survive employee working-hours changes without silent extensions', () => {
  const original = planDailyWorkflows(input()).task_drafts[0];
  const result = planDailyWorkflows(input({ now: '2026-10-07T13:30:00Z', employees: [employee({ work_end_time: '17:00' }), employee({ id: 'manager-1' })], tasks: [persist(original)], schedule_groups: [] }));
  assert.equal(result.task_tracking[0].effective_due_at, '2026-10-07T13:00:00.000Z');
  assert.equal(result.task_tracking[0].overdue_open, true); assert.equal(result.notification_drafts.length, 1);
});

test('conflicting saved deadline date blocks reminders until an approved override or reconciliation', () => {
  const original = planDailyWorkflows(input()).task_drafts[0];
  const inconsistent = persist(original, { due_date: '2026-10-06' });
  const result = planDailyWorkflows(input({ tasks: [inconsistent] }));
  assert.equal(result.task_tracking[0].overdue_open, null); assert.equal(result.notification_drafts.length, 0);
  assert.ok(hasReview(result, 'stored_deadline_requires_review'));
  const fixed = planDailyWorkflows(input({ tasks: [inconsistent], deadline_changes: [{ organization_id: 'org-1', task_id: 'persisted-1', previous_due_date: '2026-10-06', new_due_date: '2026-10-08', approval: approval() }] }));
  assert.equal(fixed.task_tracking[0].overdue_open, false);
});

test('unknown linked accounts cannot produce task drafts or in-app notifications', () => {
  const result = planDailyWorkflows(input({ employees: [employee({ user_id: null }), employee({ id: 'manager-1' })], tasks: [task()] }));
  assert.equal(result.task_drafts.length, 0); assert.equal(result.notification_drafts.length, 0);
  assert.ok(hasReview(result, 'employee_account_required')); assert.ok(hasReview(result, 'notification_recipient_unavailable'));
});

test('unsupported overnight work hours never invent a date-only deadline', () => {
  const result = planDailyWorkflows(input({ employees: [employee({ work_start_time: '23:00', work_end_time: '07:00' }), employee({ id: 'manager-1' })], tasks: [task()] }));
  assert.equal(result.task_tracking[0].effective_due_at, null); assert.equal(result.task_tracking[0].overdue_open, null);
});

test('legacy rule-plan dedupe keys work even without metadata or an unchanged due date', () => {
  const result = planDailyWorkflows(input({ plans: [plan()], schedule_groups: [], tasks: [task({ dedupe_key: 'rule-preview:org-1:plan-1:2026-10-07:content_publication%3Aduring:plan-rules-v1', due_date: '2026-10-08', metadata: null })] }));
  assert.equal(result.task_drafts.length, 0);
});

test('invalid lifecycle leaves claimed timestamp, on-time assertion and completion counters unknown', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed', started_at: '2026-10-07T05:15:00Z', completed_at: '2026-10-07T05:00:00Z', due_date: '2026-10-07' })] }));
  assert.equal(result.task_tracking[0].claimed_completed_at, null); assert.equal(result.task_tracking[0].claimed_on_time, null);
  assert.equal(employeeMetrics(result).claimed_completed_today, 0);
});

test('completed work today consumes the daily capacity using documented effort or a conservative approved estimate', () => {
  for (const patch of [{ estimated_time_minutes: 120 }, { estimated_time_minutes: 60, actual_time_minutes: 120 }]) {
    const result = planDailyWorkflows(input({ employees: [employee({ daily_capacity_minutes: 120 }), employee({ id: 'manager-1' })], tasks: [task({ status: 'completed', completed_at: '2026-10-07T05:00:00Z', ...patch })] }));
    assert.equal(result.task_drafts.length, 0); assert.equal(employeeMetrics(result).completed_capacity_minutes, 120);
    assert.ok(hasReview(result, 'workload_capacity_exceeded'));
  }
});

test('completed capacity and remaining clock time are checked separately to avoid double-counting time already spent', () => {
  const result = planDailyWorkflows(input({ now: '2026-10-07T09:00:00Z', tasks: [task({ status: 'completed', completed_at: '2026-10-07T08:30:00Z', estimated_time_minutes: 240 })] }));
  assert.equal(employeeMetrics(result).completed_capacity_minutes, 240); assert.equal(result.task_drafts.length, 1);
});

test('unknown completed effort or missing completion date blocks capacity decisions rather than assuming zero', () => {
  for (const patch of [{ estimated_time_minutes: null, completed_at: '2026-10-07T05:00:00Z' }, { estimated_time_minutes: 60, completed_at: null }]) {
    const result = planDailyWorkflows(input({ tasks: [task({ status: 'completed', ...patch })] }));
    assert.equal(result.task_drafts.length, 0); assert.equal(employeeMetrics(result).completed_capacity_minutes, null);
    assert.ok(hasReview(result, 'capacity_requires_review'));
  }
});

test('already-started future-deadline work still reserves capacity and cannot be ignored', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ due_date: '2026-10-14', estimated_time_minutes: 420 })] }));
  assert.equal(employeeMetrics(result).reserved_minutes, 420); assert.equal(result.task_drafts.length, 0);
});

test('recorded effort above an open task estimate reserves the larger amount conservatively', () => {
  const result = planDailyWorkflows(input({ tasks: [task({ estimated_time_minutes: 60, actual_time_minutes: 420 })] }));
  assert.equal(employeeMetrics(result).reserved_minutes, 420); assert.equal(result.task_drafts.length, 0);
});
