# Deterministic daily workflow core

## What is implemented

`supabase/functions/_shared/rule-daily-workflows.ts` exports the pure, synchronous `planDailyWorkflows(input)` function. It returns:

- `task_drafts`: schema-shaped task proposals from approved source plans or explicitly approved recurrence groups
- `notification_drafts`: employee-addressed, in-app overdue reminder proposals
- `task_tracking` and `employee_tracking`: documented dates, counts, approval/evidence states, and capacity observations
- `needs_review` and `skipped`: explicit exception outcomes
- An uninstalled 08:00 Asia/Riyadh daily-job proposal

It performs no authentication, database reads/writes, network calls, notification delivery, job installation, credential access, or employee scoring. Its authorization and approval fields are trusted adapter attestations, not self-authorizing browser input. It is not exposed as an HTTP endpoint. No cron is configured.

The existing `rule-approved-month-v1` persistence contract does not accept daily workflow drafts. This addition neither modifies nor expands that contract.

## Input contract

All collections are mandatory and organization-scoped. The future caller must supply an authenticated organization and actor, a valid offset-bearing `now`, explicit current Saudi work calendar, and a complete snapshot of employees, plans, groups, tasks, leave, human completion reviews, approved deadline changes, and notification receipts. `snapshot_complete: false` blocks actionable drafts and sets aggregate counts to `null`.

Employee identifiers, `user_id`, status, viewer-account flag, and work-start/end fields follow the existing employees schema. Daily capacity is a separate, explicit policy input. It cannot exceed the same-day work shift. Overnight shifts require a separately designed policy and are held for review.

Existing task fields mirror the known tasks schema. The planner does not consume the existing quality/completion percentages or AI scores. `actual_time_minutes` is optional recorded effort for conservative capacity reservation, not an employee performance score.

Approved plans wrap existing `SourcePlan` data, explicit per-occurrence time estimates, approval identity/revision, and the calendar approved with that allocation. Reusing `rule-plans.ts` preserves supported activity templates and exact integer allocations. The current calendar can suppress an occurrence but cannot silently redistribute the approved target across remaining days. A newly declared holiday on an allocated date requires review.

Standalone schedule groups contain explicit responsible employee IDs, exact task templates and durations, an active/completed/cancelled state, an approval, inclusive start/end dates, recurrence, and a non-working-day policy. Names and prose never select employees or create instructions.

The repository has no assumed authoritative leave or supervisor-approval schema. `DailyLeave`, `DailyCompletionReview`, and `DailyDeadlineChange` are normalized adapter contracts, not migrations or claims that such tables exist. An explicit leave policy is required even when the supplied leave array is empty.

Approval attestations must identify an in-scope non-viewer reviewer and a non-future timestamp. The adapter must verify actual authority for the approval category; a boolean from an untrusted client does not suffice. Supervisor/evidence approval cannot be self-approved.

## Recurrence and exception semantics

- All local dates use Asia/Riyadh. The supplied clock is the only clock.
- Daily intervals count calendar days from `start_date`.
- Weekly intervals use Sunday-based weeks anchored to the week containing `start_date`, with explicit weekdays.
- Monthly intervals count calendar months from `start_date`. Missing dates such as February 31 are explicitly skipped or reviewed, never silently clamped.
- Only today's occurrence is proposed. Missed days are not backfilled or shifted automatically.
- New task proposals are gated until 08:00 local. Late proposals must still fit the remaining same-day work time and daily capacity.
- Non-working dates and approved leave suppress task and reminder drafts. Pending/unverified leave requires review. No substitution or reassignment is performed.
- Completed/cancelled sources are excluded. Existing completed/cancelled occurrences remain deduplication tombstones.
- Unknown dates, durations, statuses, identities, chronology, and approval states produce review items or `null`; no missing fact becomes a zero score.

## Task identity and deadlines

Daily task keys encode version, organization, source kind, source identity, employee identity, occurrence date, and template. Approval revision and mutable deadline are deliberately excluded. Repeating the same input produces the same proposal; supplying a persisted occurrence prevents recreation, including after approval edits, completion, cancellation, or deadline extension.

Task metadata preserves the original occurrence date. Legacy `rule-preview` keys are also recognized, including tasks whose current deadline changed. Legacy plan metadata can deduplicate unmodified occurrences. Ambiguous source/occurrence records are held for review. A plan occurrence already assigned to another employee cannot be silently reassigned.

`task_drafts[].due_date` is a calendar date, matching the existing PostgreSQL date column. `metadata.deadline_at` freezes the exact working-day-end timestamp. `user_id` is the responsible employee's verified linked account, not the actor's account. A future adapter must preserve this metadata.

A date-only legacy deadline without frozen metadata is interpreted using the explicit employee work-end time. A stored timestamp conflicting with the task's date requires reconciliation. A single authorized deadline override can replace the current deadline. Multiple revisions, stale previous dates, unapproved changes, and invalid dates are held for review. Timeliness observations use the effective deadline as of the supplied snapshot; they are not a reconstruction of past policy or past deadlines.

## Workload capacity

The daily capacity input is the total daily budget, not a replenishing remaining budget. Open work due today or earlier, and already-started/in-progress work regardless of deadline, reserves its complete supplied estimate conservatively. A larger documented effort figure takes precedence for this reservation; future unstarted work is not assumed to be today's work. Unknown relevant estimates or deadlines prevent additional assignment.

Work completed today consumes daily capacity using recorded `actual_time_minutes` when available, otherwise its supplied estimate. Unknown completion timing or effort leaves consumed capacity unknown. This is a conservative scheduling reservation, not a claim that all effort occurred on the completion date. Precise cross-day effort accounting requires authoritative daily work logs and a separately reviewed adapter policy.

The planner separately checks:

1. Completed-capacity reservation + open reservation + new drafts against the total daily budget
2. Open reservation + new drafts against remaining working-clock time

It does not mistake elapsed wall-clock duration for active effort. Candidate ordering is stable by source, employee, and template identity. If capacity is insufficient, human prioritization is required; no quality or high-impact employee ranking is calculated.

## Completion and daily observations

A completed/executed status or valid completion timestamp is a completion claim, not proof of quality or supervisor approval. Completed work without approval is `awaiting_human_review` and receives no overdue reminder. A contradictory lifecycle remains unknown and cannot produce trusted completion/timeliness assertions.

Evidence submission, human verification/rejection, and supervisor approval/rejection are separate fields. A valid supervisor approval must follow a documented completion claim. `claimed_on_time` and `approved_on_time` are separate; neither becomes a quality score. The recorded elapsed interval is shown only when start/completion chronology is valid and is not an active-work measurement.

Daily employee counts include known due-today tasks, documented claims today, authorized approvals today, known open overdue tasks, unknown completion reviews, and unknown deadlines. They are inspectable counts, not personnel recommendations. Quality scores and ranks remain `null`. The existing evaluation weights, including the existing AI-usage component, are unchanged and remain a separate owner policy decision.

## Notification idempotency and delivery boundary

The reminder key includes organization, task, employee, and local date. Deadline edits on the same day cannot create a second reminder after a receipt is present. A still-overdue task can have a new proposal on the next working day. Exact due time is not overdue; the clock must be later.

Reminders are proposed only during the recipient's valid working hours, on a working day, outside leave, for a known open overdue task with a linked user account. Completed/cancelled tasks and ambiguous states are excluded. There is no manager escalation, email, SMS, or external provider fanout.

The existing notifications table has no assumed dedupe ledger column. The normalized receipt input is not such a migration. A production adapter needs a transactionally unique ledger/outbox, replay-safe task identities, current authorization checks, and a state/deadline recheck before publishing. In-memory deduplication alone does not guarantee exactly-once delivery across concurrent processes.

## Bounds and release gates

Limits: 10,000 top-level records, 500 employees, 200 sources, 20 templates per group, 100 recipients per group, 10,000 candidate expansions, and 500 combined task/reminder drafts. Exceeding record or output limits throws before returning any partial proposal. A source plan has at most twelve monthly allocations. Input objects are not mutated.

Before any runtime integration, separately review and approve:

- Authoritative source/leave/calendar/completion adapters and trusted category-specific approval checks
- Snapshot pagination/freshness, role/RLS checks, and transactionally revalidated application
- Task and notification-ledger uniqueness, race/retry handling, and current legacy-trigger interactions
- Employee work schedules, capacity/effort policy, holiday and leave exceptions
- Scheduler ownership, job time, catch-up policy, runtime authorization, and safe deployment
- Human quality/evidence rubric and any evaluation-weight changes

No such integration, schedule activation, production mutation, or deployment is performed here.

## Verification

Run the focused suite:

```sh
node --test tests/rule-daily-workflows.test.ts
npx tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom --strict --skipLibCheck supabase/functions/_shared/rule-daily-workflows.ts tests/rule-daily-workflows.test.ts
npx eslint supabase/functions/_shared/rule-daily-workflows.ts tests/rule-daily-workflows.test.ts
```

The normal `npm run test:rules` wildcard includes the new tests. The repository's `typecheck:rules` script currently follows the existing runtime entrypoint, so use the explicit daily-file typecheck above until a separately reviewed runtime adapter imports this core.
