# Deterministic automation: review checkpoint

Base: `2841fed3f6e5ce010984b2b8444d94b6d9b2313c`. This branch is not deployed and is not a completed production migration. The owner’s latest goal is minimum-cost hybrid operation: deterministic routine workflows plus optional, bounded advisory AI quality review. This checkpoint covers the deterministic foundation. Advisory activation/budget/privacy remain unapproved and disabled.

## Policy and cost boundary

- `KFAAH_AUTOMATION_MODE=rules` is the default. Missing, misspelled and unknown values also select rules. Only the exact value `legacy_ai` invokes retained legacy handlers.
- All 32 inventoried model/crawler/voice entrypoints are wrapped before legacy work. Both automatic task dispatchers are also blocked in rules mode pending an approved persistence workflow.
- Rules use an origin-and-capability allowlist for the configured platform's authenticated auth, REST and storage APIs. Custom model proxies, localhost model servers, crawler/voice providers, internal function fan-out, and redirects are blocked. Credentials are never sent to an alternate origin.
- This establishes zero provider calls for covered rules-mode operations. Hosting, storage, database, GitHub Actions, external email services and other infrastructure are not free. Separate existing coding/deployment workflows are not changed or executed by this feature.
- Dependency installation/build-time downloads are separate from application provider calls. Excel runtime modules are vendored locally; PDF dependencies are pinned and must be bundled/cached before isolated execution.

## Implemented alternatives

| Area | Rules behavior |
|---|---|
| Donations and daily intelligence | Integer-cent arithmetic, explicit success statuses, Saudi calendar periods, equal-period comparisons, prior-cohort major-donor retention, invalid/duplicate/currency coverage and source evidence. No predicted revenue or causal claim. |
| Donor panels | Verified organization rows override client totals. Requested panel retained; source and limits accompany the familiar JSON sections. |
| Files | Bounded UTF-8 TXT/CSV, structured XLSX/XLS, real text-PDF extraction. Office ZIP metadata and decompression limits are validated. Image-only PDF reports `ocr_unsupported`; no raw binary-text fallback. |
| Plans | Exact column aliases preserve original Excel rows. Explicit targets distribute with largest remainder across configured workdays, retaining exact totals. Unknown activities, missing responsibility and inconsistent targets require review. |
| Tasks | Stable organization/plan/date/template keys, existing/completed deduplication, server-validated employee scope and no synthetic task quota. Previews do not delete, assign, or notify. |
| Assistant | Read-only typed intents for donation summaries, personal tasks, overdue tasks and recorded organization profile. Unsupported requests/dates clarify. No SQL generation, browsing or general-language-model promise. |
| Expenses | Explicit Arabic/English keyword matching, conjunctions and negation checks. Conflicting/unknown categories return `needs_review`; the import UI requires a resolved selection before saving. |
| Finance reports | Catalog gated by available verified records; missing/mixed currencies remain unavailable. Recorded donations minus expenses is not described as a bank balance. |
| Marketing | Channel-specific drafts, briefs, campaign templates and arithmetic from scoped campaign data. Unknown currency/grain is not guessed. Subjective performance grades are withheld. |
| Executive/admin/report/innovation suggestions | Deterministic evidence-backed summaries and reviewable templates. Source periods override client labels. Historical AI material is not treated as newly verified evidence. |

The authenticated Arabic preview screen is `/automation-preview` or `/:slug/automation-preview`. It supports evidence, warnings, cancellation, tenant switches and read-only donor/file/plan/task review. Existing file and daily-donor screens distinguish new previews from saved historical analyses.

Some old generation buttons return `409 preview_requires_review` with a prepared preview, because their legacy clients assume immediate persistence. This is intentional until the approved commit flow is integrated. The dedicated preview page renders these alternatives directly.

## Explicit remaining capability limits

- General creative chat, live website discovery/crawling, website/store semantic analysis, text-to-speech and external-source extraction have no generic replacement in this checkpoint. They return explicit unavailable responses rather than provider fallback.
- Evidence validity and employee work quality require an approved rubric and human review. This code changes neither historical scores nor existing weights and never manufactures a quality grade.
- Rules previews are not automatically persisted. The next isolated implementation is an explicit review-hash/confirmation/atomic-persistence boundary, with no overwrite of completed/manual/legacy work or automatic external notification.
- Complete authorized reads are paginated with exact counts. Unknown/inconsistent totals or more than 50,000 rows fail explicitly rather than yield sampled totals. A SQL aggregate path is required for larger datasets. Reads are not a database snapshot transaction.
- Plan expansion is bounded to 200 source plans and 5,000 daily preview records; narrow the requested selection beyond that.
- Tables without currency columns retain activity counts but cannot establish monetary totals without an approved storage contract. No implicit SAR assumption or currency conversion is made.

## Security and preservation

Authentication, approved membership and organization-scoped roles precede business reads. Requests use the caller's bearer token and RLS rather than a service-role read bypass. File downloads use authenticated storage URLs with storage RLS and bounded streaming reads. Cross-tenant IDs are rejected; staff responsibility is validated against the selected organization's employees.

Original file paths are now recorded after a checked storage upload. Rules-mode uploads do not trigger intelligence/innovation fan-out or delete historical AI caches. Existing imports use patched SheetJS CE 0.20.3, pinned to the official vendor archive; the rules parser additionally verifies format/resource limits. No database migration has been applied.

The `ai_generated` filters on historical records are intentionally not rewritten: rules tasks remain previews until the provenance/persistence migration is reviewed. Historical `ai_analysis` content stays intact and is labelled as previous saved analysis. Chat-count scoring is not recast as evidence of employee quality.

## Checks at this checkpoint

- Node 24 deterministic unit and runtime integration tests: 157 passing.
- Actual entrypoint tests cover all 32 provider routes plus both dispatchers in default, rules and invalid modes with fetch/write/timer/background spies.
- Real XLSX/XLS and text/image-only PDF fixtures, corruption, compression limits, ambiguous Arabic amounts/currencies/dates and malformed input tests pass.
- Exact Deno 2.9.6 parser smoke tests use network denial and cached dependencies. See `tests/local-document-parser.deno.ts` for the supported command.
- Strict new-core TypeScript and application TypeScript pass. Targeted lint has no errors; the combined component/helper file has two existing-style Fast Refresh warnings.
- Frontend production build and source-independence checks pass with `VITE_SUPABASE_URL=https://kfaah.sa` and a non-secret placeholder public key; no production API was called.
- Existing worker/promotion safety checks pass. Prepared-release tests have one environment-blocked case because this executor lacks `rsync`; eleven other cases pass. No deployment was attempted.
- Full repository lint remains failing: unchanged baseline has 950 errors/80 warnings; checkpoint has 948 errors/82 warnings (the two additional warnings are the shared UI helper exports). No full-repository lint-clean claim is made.
- Thirty-one DOM interaction and actual-producer compatibility tests pass with synthetic local fixtures, including double-click deduplication, cancellation, ignored-abort stale responses, tenant/account changes, error retries and read-only call assertions. Chromium launch is blocked by this executor’s process-singleton socket restriction, so rendered browser/mobile QA is not yet verified. Production RLS, deployed storage policies, actual database contracts and actual server configuration still require a separately authorized staging validation.

## Release, migration and rollback plan

1. Review this draft branch and fixtures; keep live unchanged.
2. Finish explicit approved persistence, schema/provenance changes and database-level transaction/idempotency tests. Do not convert historical AI booleans in bulk.
3. Validate staging with a copied synthetic/authorized dataset, real scoped RLS/storage and the exact Edge Runtime bundle. Verify zero provider egress in server logs.
4. Agree employee-evaluation policy separately; preserve historic results and disclose any new formula/version.
5. Verify every active UI path and background scheduler for capabilities, current labels, consent and meaningful failure states. Review larger-dataset aggregate coverage and source contracts.
6. Only after separate live approval, deploy the reviewed commit through the existing staging/promotion process. The safe selected mode is rules. No provider keys need to be added.
7. For rollback, restore the prior reviewed release and any explicitly approved migration rollback; do not delete generated or historical data. Enabling `legacy_ai` reintroduces provider behavior and costs and is a separate deliberate operator choice, not an automatic fallback.


## Second isolated checkpoint: daily workflow, approval and hybrid policy

The next checkpoint adds tested source code, not active production jobs:

- `planDailyWorkflows` generates deterministic daily task and in-app reminder proposals, with recurrence, workday/leave/capacity/deadline handling, stable identities and separate claimed/human-approved completion. No scheduler is installed. Its adapter authority must come from verified stored approvals, not browser flags.
- `apply-rule-preview` and migration `0025_rule_approved_previews.sql` add a narrow review-hash/explicit-confirmation/atomic-insert contract for one saved plan month. Both persistence switches default off. Nothing has been migrated. The new restricted role/grants require a separate security approval before eventual execution. The next UI integration is still separate from this backend checkpoint.
- `selectQualityAdvisory` implements default-off eligibility, cache identity and conservative budget-reservation proposals. It makes zero provider calls and changes no grades. This follows the owner's minimum-cost hybrid clarification. Provider/privacy/activation/current-price/budget approvals and an atomic ledger are required before any real advisory request.
- The standard suite now runs the pinned embedded PostgreSQL fixture rather than skipping it. All 251 tests pass, including 54 daily-workflow tests and 18 advisory-policy tests. The aggregate rules typecheck and focused lint pass. The previously tested frontend snapshot remains unchanged in this backend checkpoint.

See `RULE_DAILY_WORKFLOWS.md`, `rule-approval.md` and `QUALITY_ADVISORY.md` for exact contracts and gates. Live task creation, reminder delivery, AI dispatch, migrations, role grants, deployment and employee scoring weights remain unchanged.


## Integrated approval UI checkpoint

The explicit-approval panel is now wired to task previews. It sends selectors only, validates the real SQL review envelope/hash/user/organization, displays the named employee and preservation evidence, distinguishes database and edge gates, and requires a checkbox plus final confirmation. Annual-only/ambiguous groups remain blocked. Uncertain commits are never retried automatically. Approved new tasks use `upcoming`, matching existing manual creation and daily task selection.

Pinned test-only DOM and embedded PostgreSQL dependencies make all 291 tests reproducible through `npm run test:rules` with no skipped tests or external fixture directory. Thirty-one additional whole-preview DOM scenarios passed separately. Both application and rules typechecks and focused lint pass. The source does not activate database persistence, roles/grants, notifications, daily scheduling or advisory AI. Real-browser layout/mobile verification and actual staging catalogs remain release gates.
