# Reviewed monthly task persistence: isolated implementation

Status: implementation and local-fixture validation only. No migration, role, grant, setting, task, or plan has been changed on a server. No deployment or production data inspection was performed. This is a separate, narrower boundary than read-only `automation-preview`; the explicit review/confirmation panel is wired only to task previews and remains disabled by the default-off gates.

## Supported contract

`POST /functions/v1/apply-rule-preview` accepts exactly:

- `action`: `review` or `commit`
- `organization_id`, `source_plan_id`, `source_month_id`, `assigned_employee_id`: UUID selectors
- `task_dates`: 1–31 distinct date-only values within one month
- For commit only: `confirmed: true` and the exact `review_hash` from review

The selected employee must be the operational plan's recorded responsible employee, active, not a viewer, linked to a user with approved membership in the same organization. No client task rows, free-text assignments, custom calendars, invented budgets, quality scores, or arbitrary table writes are accepted. Only recognized exact activity names and an explicit saved monthly target are supported. Annual-only plans remain preview-only. The SQL function requires an approved organization administrator or global super-admin and intersects that check with the deployed task-policy helper. Moderators retain read-only preview capabilities.

The review response contains `review`, the exact canonical `review_json`, a SHA-256 `review_hash`, preservation evidence, and source/employee snapshots. The hash is a change detector, not a bearer token or substitute for authorization. It binds the current user, organization, selected source month, employee, dates, source data and resulting payload. Dates and source timestamps are canonicalized under fixed database date/time settings. Display the named employee, dates, targets, task titles and preserved rows before asking for confirmation.

On commit, one database transaction locks the relevant source/auth tables and tasks, repeats authorization, recomputes the review, compares the hash, inserts the derived tasks, and writes an immutable private receipt with original task identities and allocations. That private history, rather than editable task metadata alone, detects moved dates, changed phases/keys, duplicate rows, source changes, and deleted tasks before any extension. There is no upsert, delete, bulk replacement or update of existing tasks/plans. Replays of the same user's exact receipt return `already_applied`, with zero new task writes. Changed selectors cannot reuse that receipt. A failed batch rolls back both tasks and receipt. A receipt records the original outcome; it does not re-create tasks that someone later deletes.

New tasks use UUID database IDs, `source: rules_approved`, `ai_generated: false`, the deterministic preview identity as `dedupe_key`, and source/evidence/approval metadata. They use the task UI's `upcoming` status (the same status as manual creation and the daily task selector) and `medium` priority, without inferred estimates or assessment scores. They do not invent a foreign key to an executive plan. Existing tasks linked by source metadata, dedupe identity, or matching executive-plan month/day are preserved regardless of completion/manual/legacy status. The new partial unique index protects new rule-task identities without modifying historical rows.

Target allocation uses all working days in the full source month (Sunday–Thursday, Asia/Riyadh calendar, no inferred holidays); selecting fewer days does not change the denominator. Explicit monthly targets must be nonnegative integers consistent with the annual total and saved monthly rows. The creation subset never claims to reconcile unknown historical task targets. Existing manual/legacy coverage or previously approved activity, assignment, target, or allocation changes return `needs_review` and `can_commit: false`; commit is refused without touching those rows. Allocation checks cover the entire source month, including dates outside the requested subset. Previously scheduled/completed executive daily rows also invalidate review and block this first contract until a separate reconciliation adapter is reviewed.

## Authority and rollout gates

- `rule_approval_private.settings.enabled` defaults to false and is the authoritative database persistence switch. Ordinary clients cannot access this private schema.
- `KFAAH_RULE_PERSISTENCE=approved_month_v1` additionally enables the edge commit route. This is not a database-wide kill switch: authenticated callers may invoke the same tightly validated SQL RPC directly when the database gate is enabled.
- The endpoint never invokes a provider, even if legacy AI mode is set. The UI validates the exact review packet, named employee, scope and hash, then requires a checkbox and final confirmation; it never retries an uncertain commit automatically.
- The migration creates `kfaah_rule_executor`, a non-login, non-superuser, non-BYPASSRLS role inheriting the existing authenticated role. It owns only the approval functions, not application tables. This allows a transaction to write private immutable receipts while retaining task/source RLS. Creating this persistent role and grant requires separate explicit security approval before eventual execution. Code review approval is not that permission.
- Default PUBLIC/anonymous execution is revoked. Only the two narrow public RPCs are executable by authenticated users; helper functions are private.
- Task insertion fails closed for inactive RLS, table-owner/BYPASSRLS execution, unexpected INSERT triggers/rules, changed audited trigger code, unexpected columns/default opportunities, or user-defined constraint/index expressions. The one audited organization-fill trigger is verified by function OID, exact normalized body hash, language and trigger structure. Triggers are never disabled or bypassed.

The runtime gate is not a claim that all production schema, policies, extensions, server jobs, or network settings have been audited. Review the live catalog and test the actual migration order in an approved staging environment before enabling persistence. Task-side notifications are deliberately absent from this implementation.

## Source evidence

Pinned repository: `gaberalhrese-cloud/shop-soulmate-04` at `2841fed3f6e5ce010984b2b8444d94b6d9b2313c`. All 219 SQL migrations (194 Supabase, 25 Drizzle) were inspected, beyond the sparse checkout.

- Initial task schema, date-only deadlines, original own-user INSERT policy and UPDATE timestamp trigger: [20260108232508](https://github.com/gaberalhrese-cloud/shop-soulmate-04/blob/2841fed3f6e5ce010984b2b8444d94b6d9b2313c/supabase/migrations/20260108232508_776c2e4e-3d86-4b16-983a-e98117112de7.sql)
- Only migration-defined task INSERT trigger fills a null organization ID; it does not validate explicit IDs: [20260419220240](https://github.com/gaberalhrese-cloud/shop-soulmate-04/blob/2841fed3f6e5ce010984b2b8444d94b6d9b2313c/supabase/migrations/20260419220240_ee99e8c6-eccd-4892-8758-8e034f5dfae2.sql)
- Existing dedupe index is non-unique: [20260510222719](https://github.com/gaberalhrese-cloud/shop-soulmate-04/blob/2841fed3f6e5ce010984b2b8444d94b6d9b2313c/supabase/migrations/20260510222719_f2cb78d2-1a84-421a-9c54-c66ccdc12111.sql)
- Explicit employee assignment: [Drizzle 0018](https://github.com/gaberalhrese-cloud/shop-soulmate-04/blob/2841fed3f6e5ce010984b2b8444d94b6d9b2313c/drizzle/migrations/0018_tasks_assigned_employee_id.sql)
- Strict organization roles: [Drizzle 0021](https://github.com/gaberalhrese-cloud/shop-soulmate-04/blob/2841fed3f6e5ce010984b2b8444d94b6d9b2313c/drizzle/migrations/0021_scope_elevated_roles_to_organization.sql). Supabase migration history has an older helper definition, so the new boundary does not trust migration ordering.
- Existing manual UI inserts a notification in a separate call after creating a task: [Tasks.tsx lines 721–749](https://github.com/gaberalhrese-cloud/shop-soulmate-04/blob/2841fed3f6e5ce010984b2b8444d94b6d9b2313c/src/pages/Tasks.tsx#L721-L749). This handler is not reused.

## Validation and remaining release gates

The ordinary Node suite covers strict selectors, exact user/org/hash binding, explicit confirmation, default-off behavior, stale SQL responses, no retries, user-scoped credentials and same-origin-only transport. A real PostgreSQL-in-WASM fixture runs the migration in memory, tests allocations against the shared plan rules, RLS denial, changed hooks/defaults, role/employee/source checks, partial-batch rollback, completed/manual/executive preservation, receipt idempotency, cross-user replay denial, activity-renaming dedupe, partial-approval target drift, and full-month target conservation.

The embedded test runs by default through the pinned development dependency @electric-sql/pglite@0.3.14 and is included in the standard CI test command. A separately installed official package can still be supplied for isolated reproduction:

```
npm install --prefix /tmp/kfaah-approval-sql --cache /tmp/kfaah-approval-npm-cache --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
KFAAH_PGLITE_MODULE=/tmp/kfaah-approval-sql/node_modules/@electric-sql/pglite/dist/index.js node --test tests/rule-approval.test.ts
```

The repository-pinned DOM tests run in CI by default and include a real PostgreSQL-to-UI round-trip. An isolated dependency tree can still be selected with KFAAH_UI_QA_ROOT. Real-browser visual/mobile/focus QA remains unverified because this executor blocks Chromium startup.

Remaining gates: independent security review; explicit approval for persistent role/grant creation; staging with the full source schema/policies and actual migration order; real concurrent-session lock/race tests; verification that the deployed PostgREST version/configuration hoists the function statement timeout, plus a slow-call cancellation test (embedded tests do not prove a five-second execution limit); runtime hook/catalog and background-job verification; regenerated database API types and reviewed migration-runner registration; explicit deployment approval. There is no database, environment or UI toggle changed by this implementation.
