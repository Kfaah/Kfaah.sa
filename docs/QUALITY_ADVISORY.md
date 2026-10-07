# Bounded work-output quality advisory

## Decision and current state

The owner's clarification on 2026-10-07 permits AI assistance with work-output quality, with minimum AI cost as the goal. It does not approve a provider, destination, privacy terms, spend budget, runtime activation, new evaluation weights, or personnel decisions.

The deterministic rules path remains the default, with zero provider calls. This change adds only:

- `supabase/functions/_shared/quality-advisory-policy.ts`: pure selection, cache, reservation-proposal and supervisor-review policy.
- `tests/quality-advisory-policy.test.ts`: synthetic, offline policy tests.
- This design and activation checklist.

No endpoint imports this policy. No provider adapter, prompt execution, scraper, database migration, budget ledger, approval store, credential, deployment, or production-data access was added. A `reservation_proposal` is neither an actual reservation nor permission to call a model. Every selection result has `provider_call_allowed: false`, `charged_micro_units: 0`, and `reserved_micro_units: 0`.

`bounded_advisory_v1` is a capability-specific policy value, not a runtime environment flag wired to an endpoint. Missing, invalid and `legacy_ai` values cannot enable this policy. Never activate advisory evaluation by setting the broad legacy switch: that would enable retained implementations outside these constraints.

## Why the retained quality route is insufficient

Repository inspection found:

- `evaluate-task-quality/index.ts` reads task title/description, completion and self-rated quality percentages, due date, priority, category, and recorded or estimated time. Its model prompt asks for a quality score and a time-related penalty. It does **not** fetch or inspect the submitted deliverable, file contents, evidence, or an approved output-quality rubric. Completion or speed is not evidence of the quality of the actual work.
- Its retained implementation writes a model score to `task_quality_evaluations`. Those historical outputs must not be relabelled as verified output-quality judgments.
- `verify-evidence/index.ts` is a different retained flow: it sends an evidence URL to an external scraper and its extracted content to a model, writes verdicts and scores, updates accountability status, and can create follow-up tasks. Reusing that route would reintroduce both external recipients and automatic consequential writes.
- `rule-mode.ts` currently routes both operations to human review in rules mode. This change leaves that boundary intact.
- The checked-in generated schema has task metadata, `task_quality_evaluations`, and `evidence_checks`, but no dedicated immutable task-output submission/version contract, approved rubric-version contract, advisory idempotency cache, or atomic cost-reservation ledger. `evidence_checks` is tied to accountability questions and URLs; its excerpts and scores do not establish a current, complete task deliverable.

These statements describe the checked-in code/schema only. No live database was inspected.

## Implemented policy order

1. **Default off.** Require the exact capability value plus a current, explicit organization-scoped activation approval. A future server must authenticate the caller and resolve approvals itself.
2. **Narrow trigger.** Accept only an actual submitted-evidence event or an explicit, verified supervisor review request for already submitted output. Chat messages, clock ticks, time edits, task completion, status updates and rubric/model changes alone cannot trigger a call.
3. **Version and rubric.** Require an immutable submission version and SHA-256 content digest that match the current task submission, plus a current approved organization-scoped rubric. The rubric supplies criteria, deterministic check IDs, and positive minimum evidence thresholds. A missing rubric does not get invented.
4. **Evidence sufficiency.** Require complete local extraction, unique submitted item IDs, and the rubric's minimum item/character counts. Empty, partial, unsupported, ambiguous or inadequate evidence goes to human review. Counts are prerequisites, never a quality score. Unsupported OCR is not silently sent to a paid service.
5. **Deterministic checks first.** All approved deterministic checks must be present exactly once, successful, and tied to these exact evidence and rubric hashes. Examples may include required file/section presence or arithmetic validation, as appropriate to the approved rubric. Failed/unknown checks go to human review without a model penalty. If the checks fully answer the permitted question, return `rules_sufficient` without AI. This does not assert a perfect overall quality grade. Only `semantic_review_needed` can proceed.
6. **Provider and privacy approval.** Require a named provider, exact HTTPS endpoint, explicit model revision and prompt version/hash. Require separate, valid approval identifying the organization, provider/endpoint, purpose, allowed data categories and sensitivity. Classification and minimization must cover the entire derived payload, including metadata and prompts. Unknown or highly sensitive data fails closed. Sensitive data requires specific approval for that recipient and category. A generic approval to “use AI” is insufficient.
7. **Known bounded price and budget.** Require an approved, current, complete price table for that exact model and provider, an approved currency-matched spend period, per-request/period spend ceilings, period request limit, and hard input-byte/input-token/output-token limits. Unknown costs, expiry, mismatched currency, unsafe numbers, non-text billing, or unverified token bounds block a new attempt. No live price is assumed.
8. **Cache before spending.** Require an authoritative complete cache/history lookup. Reuse completed exact matches with no new reservation or charge, including when the current spend cap is exhausted. Reserved/dispatched/uncertain matches return `await_existing`; failed or malformed matches require human review, with no automatic retry. Contradictory duplicate cache rows fail closed.
9. **Reservation proposal only.** For a new key, require a complete organization/period/currency-matched ledger snapshot and propose the maximum bounded charge plus one request. Existing spent money, outstanding reservations, spent requests and reserved requests all consume their relevant limits. No automatic fallback model or provider is allowed.
10. **Separate supervisor review.** Both favorable and unfavorable findings require supervisor approval of the exact current advisory content hash. Uncertain, uncited, malformed or version-mismatched output goes to human review. The accepted schema contains criterion-specific, evidence-referenced observations, not numeric grades. All outcomes remain advisory-only, with no grade change or personnel action.

All timestamps are explicit inputs with time zones, making selection deterministic. Inputs are metadata, hashes and verified decisions; the policy receives no raw deliverable content, credentials or personal records.

## Cache identity and stale work

The SHA-256 key is generated from a fixed-order JSON tuple containing:

- Policy contract version, organization ID and task ID
- Submitted evidence version and content digest
- Rubric ID, version and content digest
- Provider ID and exact endpoint, model ID and pinned revision
- Prompt version and content digest
- SHA-256 of the entire minimized request payload and its output token limit

The payload digest must include every model-visible instruction, rubric, deliverable extract and permitted metadata in an unambiguous server-built representation. The content digest and item IDs must come from an immutable, tenant-scoped stored submission. A URL by itself is not a content version; remote content can change while its URL stays the same. A changed redaction or relevant task instruction changes the payload digest.

Chat/time/status fields do not enter the identity, and cannot independently trigger evaluation. Replaying the same submission uses its completed cache or waits for its existing attempt. A changed rubric/model/prompt or payload on already-attempted evidence requires an explicit supervisor request and the full remaining budget checks. This is not an automatic background regrade. A new submitted version is separately eligible only after all checks pass.

Check the current evidence and rubric before reservation, immediately before dispatch, when recording the response and when presenting/approving it. If a newer submission arrives, preserve the old result as historical/stale; never apply it to the new submission or overwrite its result. `selectQualityAdvisory` and `reviewQualityAdvisory` reject current-evidence mismatches. The future integration must supply freshly read authoritative versions at each boundary; a stale snapshot cannot discover a concurrent update on its own.

## Cost model and required atomic integration

Money is represented as nonnegative safe integer **micro-units of the approved currency**: 1,000,000 micro-units equal one currency unit. Token rates use micro-units per million tokens. The proposal is:

`ceil(input_token_upper_bound × input_rate / 1,000,000) + ceil(max_output_tokens × output_rate / 1,000,000) + fixed_request_charge`

Integer arithmetic avoids floating-point under-reservation. Each token component rounds up separately. Input bounds cover all billed text, not only the deliverable. Output limits must cap **all** billable generated tokens, including reasoning where applicable. If a provider cannot guarantee those bounds or has unaccounted tool, retrieval, image, audio, caching or request charges, this text-only policy cannot authorize an attempt. Taxes/mandatory fees and currency conversion must be included in a conservatively bounded approved rate or treated as unknown and blocked. There is no automatic exchange-rate conversion.

There is **no atomic ledger implementation in this change**. Calling the pure function twice with the same empty cache returns two identical proposals; it does not create two reservations or prevent two callers from dispatching. Before any future activation, implement and test a server-side transaction which:

1. Authenticates organization access, current supervisor permissions where needed, approval validity, exact versions and payload bounds.
2. Atomically enforces a unique cache key/idempotency record, checks the expected ledger version, and reserves both worst-case money and one request within the organization's approved period limits.
3. Gives at most one dispatcher the right to consume that reservation. A ledger-version conflict or duplicate key reloads state; it never dispatches on a stale proposal.
4. Revalidates consent/current evidence before dispatch and enforces the exact destination with no unapproved redirect, fallback, tools or external URL fetching.
5. Reconciles actual known billing after a definitive result, releases only verified unused funds, and retains appropriate request accounting. Unknown billing, timeouts and post-dispatch errors retain their reservation pending reconciliation; elapsed time is not proof of zero cost and is not grounds for a paid retry.
6. Keeps immutable records of approvals, price version, payload hash, token caps, reservation, dispatch and result. Reuses the existing key across budget-period rollover rather than charging again for identical evidence.

A current approved configuration is still required for cached-advisory review. An expired approval/price blocks the policy even though local access to historical records can remain available through a separate authorized human-review view. Cached reuse itself does not require new budget headroom or a new provider request.

## Privacy and human judgment

Prefer already-authorized local evidence and local extraction. Do not send an evidence URL to a scraper, download new private sources via a model, or transmit raw donor/beneficiary/employee records to any recipient merely to improve a quality estimate. Use the smallest necessary, redacted work-output excerpt. Any approved external extraction service would be a separate data recipient requiring its own authorization; this policy adds none.

Before activation, identify the exact data categories and provider endpoint, purpose, retention/deletion terms, training use, processing location/subprocessors and access controls. Store hashes and minimal metadata in operational logs, not raw payloads or bearer/signed URLs. Never include credentials or other highly sensitive data. If a useful safe extract cannot be prepared, use human review.

Model output and evidence text are untrusted. A future prompt must treat content as evidence, not executable instructions, and must have no tools or permissions to act. Findings must cite submitted evidence item IDs and approved rubric criteria. Citation presence is not proof of correctness; the supervisor checks the content. Supervisor approval must be authenticated and revocable, scoped to the organization/task and exact advisory content hash. Changing an observation invalidates earlier approval.

Supervisor approval may expose a clearly labelled work-output advisory. It must not automatically change `tasks.quality_percentage`, `task_quality_evaluations.quality_score`, accountability verdict/status, staff ranking, payroll, disciplinary outcomes, or task assignments. No existing grading weights or historical records change. Any later use in an evaluation formula or personnel process requires a separately approved design and appropriate human decision-making; this module provides no such action.

## Decisions still required before activation

1. **Budget and provider:** Which exact provider/model/revision and destination? Which currency, approved current price table, maximum per request, maximum per day/month (including outstanding reservations), and maximum request count? No amount or commercial provider is selected here.
2. **Frequency and scope:** Which tasks and approved rubrics qualify? Automatic evaluation only on newly submitted eligible output, or only on explicit supervisor request? Normal reuse is once per evidence/rubric/model/prompt/payload identity; changed-config reevaluation requires explicit review. What are the approved minimum evidence thresholds and token/byte caps?
3. **Privacy:** Which specific work-output fields may be sent to that recipient, under which processing/retention terms and approved sensitivity categories? Who authorizes this and who reviews the findings?

These are activation decisions, not blockers to this offline implementation. Production enablement, credentials/persistent access, schema migration, egress changes, deployment and any paid test remain separate approvals. The retained broad legacy routes are not the activation path.

## Verification and remaining release gates

Implemented offline coverage includes default-off behavior, non-triggers, exact tenant/version/rubric bindings, insufficient evidence, deterministic-first checks, privacy denial, unknown/expired pricing, input/output limits, integer rounding, spent-plus-reserved caps, cache replay/in-flight/uncertain states, changed-configuration review, positive/negative/mixed supervisor approval, stale output rejection and a no-I/O source check.

Run focused checks:

```sh
node --test tests/quality-advisory-policy.test.ts
npx tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom --strict --skipLibCheck supabase/functions/_shared/quality-advisory-policy.ts
npx eslint supabase/functions/_shared/quality-advisory-policy.ts tests/quality-advisory-policy.test.ts
```

The repository's `npm run test:rules` glob includes these tests. `npm run typecheck:rules` uses `tsconfig.rules.json`, which includes this deliberately isolated module without wiring it into any runtime endpoint. The focused commands above remain useful for reviewing the policy independently.

Still unimplemented and unverified: real immutable submissions/rubric approval persistence; authenticated runtime integration; privacy/retention enforcement; transactional budget and cache storage; concurrency/timeout/period-rollover tests against that real ledger; provider token/billing guarantees; output schema enforcement at the adapter; supervisor approval UI/audit persistence; and staging/live rollout. Offline tests must not be described as proof of those future capabilities.
