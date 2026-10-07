import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUALITY_ADVISORY_MODE, qualityAdvisoryCacheKey, reviewQualityAdvisory, selectQualityAdvisory,
  type QualityAdvisory, type QualityAdvisoryInput, type QualitySupervisorApproval,
} from '../supabase/functions/_shared/quality-advisory-policy.ts';

const sha = (character: string) => character.repeat(64);
function fixture(): QualityAdvisoryInput {
  return {
    now: '2026-10-07T12:00:00Z', trigger: 'evidence_submitted', scope_verified: true,
    organization_id: 'organization-a', task_id: 'task-a',
    evidence: { version: 'submission-1', content_sha256: sha('a'), submitted: true, item_ids: ['output-1'],
      extracted_chars: 1000, extraction: 'complete', sensitivity: 'regular', data_categories: ['work_output'], minimized: true },
    current_evidence: { version: 'submission-1', content_sha256: sha('a') },
    rubric: { id: 'rubric-a', version: 'rubric-version-1', content_sha256: sha('b'), organization_id: 'organization-a',
      approved: true, approval_id: 'rubric-approval', criterion_ids: ['accuracy', 'completeness'], deterministic_check_ids: ['required_sections'],
      minimum_items: 1, minimum_extracted_chars: 100 },
    deterministic: { complete: true, evidence_version: 'submission-1', evidence_sha256: sha('a'), rubric_sha256: sha('b'),
      checks: [{ id: 'required_sections', status: 'pass' }], outcome: 'semantic_review_needed' },
    payload: { sha256: sha('c'), byte_count: 4000, input_token_upper_bound: 1000, max_output_tokens: 200, token_bound_verified: true, kind: 'text_only' },
    policy: { mode: QUALITY_ADVISORY_MODE, organization_id: 'organization-a', activation_approval_id: 'activation-approval', approved: true,
      valid_until: '2026-11-01T00:00:00Z', frequency: 'once_per_submitted_version_and_rubric', provider_id: 'fixture-provider',
      model_id: 'fixture-model', model_revision: 'pinned-2026-10', endpoint: 'https://provider.invalid/v1/advisory', prompt_version: 'prompt-1', prompt_sha256: sha('d'),
      privacy: { approved: true, approval_id: 'privacy-approval', organization_id: 'organization-a', provider_id: 'fixture-provider',
        endpoint: 'https://provider.invalid/v1/advisory', purpose: 'work_output_quality_advisory', allowed_sensitivities: ['regular'],
        allowed_data_categories: ['work_output'], valid_until: '2026-11-01T00:00:00Z' },
      pricing: { approved: true, id: 'fixture-price-1', provider_id: 'fixture-provider', model_id: 'fixture-model', model_revision: 'pinned-2026-10',
        currency: 'USD', billing: 'bounded_text_tokens', all_charges_known: true, input_micro_units_per_million_tokens: 1_000_000,
        output_micro_units_per_million_tokens: 2_000_000, fixed_micro_units_per_request: 10,
        valid_from: '2026-10-01T00:00:00Z', valid_until: '2026-11-01T00:00:00Z' },
      budget: { approved: true, approval_id: 'budget-approval', currency: 'USD', period_id: '2026-10', period_start: '2026-10-01T00:00:00Z',
        period_end: '2026-11-01T00:00:00Z', per_request_cap_micro_units: 2000, period_cap_micro_units: 10000,
        max_requests_per_period: 5, max_input_tokens: 1500, max_output_tokens: 250, max_input_bytes: 5000 } },
    budget_snapshot: { organization_id: 'organization-a', period_id: '2026-10', currency: 'USD', ledger_version: 'ledger-8', complete: true,
      spent_micro_units: 2000, reserved_micro_units: 1000, spent_requests: 1, reserved_requests: 1 },
    cache_snapshot_complete: true, cache: [], prior_attempt_for_evidence: false,
  };
}
function set(input: QualityAdvisoryInput, path: string, value: unknown) {
  const keys = path.split('.');
  let target = input as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys[keys.length - 1]] = value;
}
async function changed(path: string, value: unknown) {
  const input = fixture(); set(input, path, value); return selectQualityAdvisory(input);
}

test('missing, legacy, misspelled and broad enablement settings remain default-off', async () => {
  for (const value of [undefined, null, false, '', 'true', 'legacy_ai', 'rules', 'bounded_advisory_v1 ', 'BOUNDED_ADVISORY_V1']) {
    const input = fixture(); set(input, 'policy.mode', value);
    assert.equal((await selectQualityAdvisory(input)).status, 'disabled');
  }
  assert.equal((await changed('policy', undefined)).status, 'disabled');
});
test('ordinary chat, elapsed time, completion and status updates never trigger evaluation', async () => {
  for (const trigger of ['chat_message', 'task_completed', 'status_changed', 'time_updated', 'scheduled_tick', '', 'rubric_changed', 'model_changed']) {
    assert.equal((await changed('trigger', trigger)).status, 'not_triggered');
  }
  assert.equal((await changed('trigger', 'supervisor_requested')).reason, 'supervisor_request_unverified');
  assert.equal((await changed('evidence.submitted', false)).status, 'not_triggered');
});
test('server scope, explicit activation and approved rubric are mandatory', async () => {
  for (const [path, value] of [['scope_verified', false], ['organization_id', 'other'], ['task_id', ''], ['policy.approved', false],
    ['policy.activation_approval_id', ''], ['policy.valid_until', '2026-10-07T12:00:00Z'], ['policy.frequency', 'every_message'], ['now', 'yesterday']] as const) {
    assert.equal((await changed(path, value)).status, 'blocked', path);
  }
  for (const [path, value] of [['rubric.approved', false], ['rubric.organization_id', 'other'], ['rubric.approval_id', ''],
    ['rubric.content_sha256', 'guess'], ['rubric.minimum_items', 0], ['rubric.minimum_extracted_chars', 0], ['rubric.criterion_ids', []]] as const) {
    assert.equal((await changed(path, value)).reason, 'approved_rubric_required', path);
  }
});
test('only the current immutable evidence version is eligible, including content digest', async () => {
  for (const [path, value] of [['current_evidence.version', 'submission-2'], ['current_evidence.content_sha256', sha('e')], ['evidence.version', '']] as const) {
    assert.equal((await changed(path, value)).reason, 'stale_evidence_version');
  }
});
test('policy and budget clocks reject ambiguous or impossible civil timestamps', async () => {
  for (const value of ['2026-10-07T12:00:00', '2026-02-30T12:00:00Z', '2026-10-07T24:00:00Z', '2026-10-07T12:00:00+14:30', '2026-10-07']) {
    assert.equal((await changed('now', value)).reason, 'activation_not_approved');
    assert.equal((await changed('policy.valid_until', value)).reason, 'activation_not_approved');
  }
  assert.equal((await changed('now', '2026-10-07T15:00:00+03:00')).status, 'reservation_proposal');
});
test('insufficient, partial, unreadable or ambiguous evidence routes to a human with no score', async () => {
  for (const [path, value] of [['evidence.extraction', 'partial'], ['evidence.extraction', 'unsupported'], ['evidence.extraction', 'ambiguous'],
    ['evidence.extraction', 'empty'], ['evidence.item_ids', []], ['evidence.item_ids', ['a', 'a']], ['evidence.extracted_chars', 99], ['evidence.extracted_chars', NaN]] as const) {
    const result = await changed(path, value);
    assert.equal(result.reason, 'insufficient_or_ambiguous_evidence');
    assert.equal(result.automatic_grade_change, false); assert.equal(result.proposal, undefined);
  }
});
test('all approved deterministic checks must pass on these exact versions before considering AI', async () => {
  for (const [path, value] of [['deterministic.complete', false], ['deterministic.evidence_version', 'old'], ['deterministic.evidence_sha256', sha('f')],
    ['deterministic.rubric_sha256', sha('f')], ['deterministic.checks', []], ['deterministic.checks', [{ id: 'other', status: 'pass' }]],
    ['deterministic.checks.0.status', 'fail'], ['deterministic.checks.0.status', 'unknown']] as const) {
    assert.equal((await changed(path, value)).reason, 'deterministic_checks_incomplete_or_failed', path);
  }
  const sufficient = fixture(); sufficient.deterministic.outcome = 'sufficient'; sufficient.policy!.privacy.approved = false;
  assert.equal((await selectQualityAdvisory(sufficient)).status, 'rules_sufficient');
  assert.equal((await changed('deterministic.outcome', 'ambiguous')).status, 'human_review');
});
test('no export eligibility without specific recipient, purpose, categories and minimization approval', async () => {
  for (const [path, value] of [['policy.privacy.approved', false], ['policy.privacy.approval_id', ''], ['policy.privacy.provider_id', 'other'],
    ['policy.privacy.endpoint', 'https://other.invalid'], ['policy.privacy.organization_id', 'other'], ['policy.privacy.purpose', 'personnel_decision'],
    ['policy.privacy.valid_until', '2026-10-01T00:00:00Z'], ['evidence.minimized', false], ['evidence.sensitivity', 'unknown'],
    ['evidence.sensitivity', 'highly_sensitive'], ['evidence.sensitivity', 'sensitive'], ['evidence.data_categories', ['beneficiary_health']],
    ['policy.privacy.allowed_data_categories', []]] as const) {
    assert.equal((await changed(path, value)).reason, 'data_recipient_approval_required', path);
  }
  const sensitive = fixture(); sensitive.evidence.sensitivity = 'sensitive'; sensitive.policy!.privacy.allowed_sensitivities = ['sensitive'];
  assert.equal((await selectQualityAdvisory(sensitive)).status, 'reservation_proposal');
});
test('provider and price uncertainty, expiry, hidden charges, floating or invalid values fail closed', async () => {
  for (const [path, value] of [['policy.provider_id', ''], ['policy.model_revision', ''], ['policy.prompt_sha256', 'missing'],
    ['policy.endpoint', 'http://provider.invalid'], ['policy.endpoint', 'https://secret@provider.invalid'], ['policy.endpoint', 'https://provider.invalid/?token=x']] as const) {
    assert.equal((await changed(path, value)).reason, 'provider_model_or_prompt_unapproved');
  }
  for (const [path, value] of [['policy.pricing.approved', false], ['policy.pricing.all_charges_known', false], ['policy.pricing.id', ''],
    ['policy.pricing.model_revision', 'other'], ['policy.pricing.provider_id', 'other'], ['policy.pricing.currency', 'unknown'],
    ['policy.pricing.billing', 'multimodal'], ['policy.pricing.valid_until', '2026-10-07T12:00:00Z'],
    ['policy.pricing.valid_from', '2026-10-08T12:00:00Z'], ['policy.pricing.input_micro_units_per_million_tokens', -1],
    ['policy.pricing.output_micro_units_per_million_tokens', 0.1], ['policy.pricing.fixed_micro_units_per_request', Infinity]] as const) {
    assert.equal((await changed(path, value)).reason, 'approved_current_complete_price_required', path);
  }
});
test('approved spend period, currency, call count, and bounded text input/output are prerequisites', async () => {
  for (const [path, value] of [['policy.budget.approved', false], ['policy.budget.approval_id', ''], ['policy.budget.currency', 'SAR'],
    ['policy.budget.period_end', '2026-10-07T12:00:00Z'], ['policy.budget.max_requests_per_period', 0], ['policy.budget.max_input_tokens', undefined],
    ['policy.budget.max_output_tokens', Infinity], ['policy.budget.max_input_bytes', -1], ['policy.budget.period_cap_micro_units', -1]] as const) {
    assert.equal((await changed(path, value)).reason, 'approved_bounded_budget_required', path);
  }
  for (const [path, value] of [['payload.byte_count', 5001], ['payload.input_token_upper_bound', 1501], ['payload.max_output_tokens', 251],
    ['payload.token_bound_verified', false], ['payload.input_token_upper_bound', 1.5], ['payload.kind', 'image'], ['payload.sha256', ''], ['payload.max_output_tokens', 0]] as const) {
    assert.equal((await changed(path, value)).reason, 'input_or_output_bounds_invalid', path);
  }
});
test('maximum input and output costs are reserved in integer micro currency units including fixed charges', async () => {
  const input = fixture(); const before = structuredClone(input);
  const result = await selectQualityAdvisory(input);
  assert.equal(result.status, 'reservation_proposal'); assert.equal(result.proposal?.reserve_micro_units, 1410);
  assert.equal(result.proposal?.reserve_requests, 1); assert.equal(result.proposal?.expected_ledger_version, 'ledger-8');
  assert.equal(result.proposal?.atomic_reservation_required, true); assert.equal(result.proposal?.revalidate_before_dispatch, true);
  assert.equal(result.reserved_micro_units, 0); assert.equal(result.charged_micro_units, 0); assert.equal(result.provider_call_allowed, false);
  assert.deepEqual(input, before);
  assert.deepEqual(await selectQualityAdvisory(input), result, 'pure repeat has no effect; ledger must arbitrate concurrency');
  input.policy!.pricing.input_micro_units_per_million_tokens = 1; input.policy!.pricing.output_micro_units_per_million_tokens = 1;
  assert.equal((await selectQualityAdvisory(input)).proposal?.reserve_micro_units, 12, 'round up each token component');
});
test('spent and all outstanding reservations count toward period money and request limits', async () => {
  assert.equal((await changed('policy.budget.per_request_cap_micro_units', 1409)).reason, 'per_request_spend_cap');
  assert.equal((await changed('policy.budget.period_cap_micro_units', 4409)).reason, 'period_spend_cap');
  assert.equal((await changed('policy.budget.period_cap_micro_units', 4410)).status, 'reservation_proposal');
  assert.equal((await changed('policy.budget.max_requests_per_period', 2)).reason, 'period_request_cap');
  for (const [path, value] of [['budget_snapshot', undefined], ['budget_snapshot.complete', false], ['budget_snapshot.organization_id', 'other'],
    ['budget_snapshot.period_id', 'other'], ['budget_snapshot.currency', 'SAR'], ['budget_snapshot.ledger_version', ''],
    ['budget_snapshot.reserved_micro_units', -1], ['budget_snapshot.spent_micro_units', Number.MAX_SAFE_INTEGER + 1], ['budget_snapshot.reserved_requests', NaN]] as const) {
    assert.equal((await changed(path, value)).reason, 'authoritative_budget_snapshot_required', path);
  }
  assert.equal((await changed('policy.pricing.input_micro_units_per_million_tokens', Number.MAX_SAFE_INTEGER)).reason, 'per_request_spend_cap');
});
test('cache hashes bind tenant, task, evidence version/content, rubric, model, prompt and exact minimized request', async () => {
  const base = await qualityAdvisoryCacheKey(fixture());
  assert.match(base, /^[a-f0-9]{64}$/);
  for (const [path, value] of [['organization_id', 'other'], ['task_id', 'other'], ['evidence.version', 'v2'], ['evidence.content_sha256', sha('f')],
    ['rubric.id', 'other'], ['rubric.version', 'v2'], ['rubric.content_sha256', sha('f')], ['policy.provider_id', 'other'],
    ['policy.endpoint', 'https://other.invalid'], ['policy.model_id', 'other'], ['policy.model_revision', 'v2'], ['policy.prompt_version', 'v2'],
    ['policy.prompt_sha256', sha('f')], ['payload.sha256', sha('f')], ['payload.max_output_tokens', 199]] as const) {
    const input = fixture(); set(input, path, value);
    assert.notEqual(await qualityAdvisoryCacheKey(input), base, path);
  }
  const incidental = fixture(); incidental.now = '2026-10-08T00:00:00Z'; incidental.trigger = 'supervisor_requested';
  Object.assign(incidental, { chat: 'changed', completion_percentage: 100, actual_time_minutes: 999, task_status: 'completed' });
  assert.equal(await qualityAdvisoryCacheKey(incidental), base, 'chat/time/completion/status are not quality evidence');
});
test('completed cache is reused without a new charge even after spend limits are exhausted', async () => {
  const input = fixture(); input.cache = [{ cache_key: await qualityAdvisoryCacheKey(input), state: 'completed', advisory_id: 'advisory-1' }];
  input.budget_snapshot!.spent_micro_units = 10000; input.budget_snapshot!.spent_requests = 5;
  const result = await selectQualityAdvisory(input);
  assert.equal(result.status, 'cached_advisory'); assert.equal(result.advisory_id, 'advisory-1'); assert.equal(result.proposal, undefined);
  assert.equal(result.reserved_micro_units, 0); assert.equal(result.charged_micro_units, 0); assert.equal(result.requires_supervisor_approval, true);
  input.current_evidence.version = 'submission-2';
  assert.equal((await selectQualityAdvisory(input)).reason, 'stale_evidence_version', 'old cache cannot mask a newer submission');
});
test('pending, dispatched or unknown attempts block duplicate reservations; failures never retry automatically', async () => {
  for (const state of ['reserved', 'dispatched', 'unknown', 'failed', 'completed'] as const) {
    const input = fixture(); input.cache = [{ cache_key: await qualityAdvisoryCacheKey(input), state }];
    const result = await selectQualityAdvisory(input);
    assert.equal(result.status, ['reserved', 'dispatched', 'unknown'].includes(state) ? 'await_existing' : 'human_review');
    assert.equal(result.proposal, undefined);
  }
  assert.equal((await changed('cache_snapshot_complete', false)).reason, 'authoritative_cache_history_required');
  const conflict = fixture(); const key = await qualityAdvisoryCacheKey(conflict);
  conflict.cache = [{ cache_key: key, state: 'reserved' }, { cache_key: key, state: 'completed', advisory_id: 'a' }];
  assert.equal((await selectQualityAdvisory(conflict)).reason, 'cache_state_conflict');
});
test('changed rubric/model/prompt on existing evidence needs explicit supervisor request and full remaining budget', async () => {
  const input = fixture(); input.prior_attempt_for_evidence = true;
  assert.equal((await selectQualityAdvisory(input)).reason, 'changed_configuration_requires_explicit_review');
  input.supervisor_requested = true; input.trigger = 'supervisor_requested';
  assert.equal((await selectQualityAdvisory(input)).status, 'reservation_proposal');
  input.budget_snapshot!.reserved_micro_units = 9000;
  assert.equal((await selectQualityAdvisory(input)).reason, 'period_spend_cap');
});

async function completed(disposition: QualityAdvisory['disposition'] = 'positive') {
  const input = fixture(); const key = await qualityAdvisoryCacheKey(input);
  input.cache = [{ cache_key: key, state: 'completed', advisory_id: 'advisory-1' }];
  const advisory: QualityAdvisory = { id: 'advisory-1', cache_key: key, evidence_version: 'submission-1', evidence_sha256: sha('a'), rubric_sha256: sha('b'),
    disposition, observations: [{ criterion_id: 'accuracy', evidence_item_id: 'output-1', text: 'Fixture observation for supervisor verification.' }] };
  return { input, advisory };
}
test('positive, negative and mixed results are equally advisory-only and require exact supervisor approval', async () => {
  for (const disposition of ['positive', 'negative', 'mixed'] as const) {
    const { input, advisory } = await completed(disposition);
    const pending = await reviewQualityAdvisory(input, advisory);
    assert.equal(pending.status, 'supervisor_review_required');
    const approval: QualitySupervisorApproval = { approved: true, verified: true, supervisor_user_id: 'supervisor-1',
      organization_id: input.organization_id, task_id: input.task_id, advisory_sha256: pending.advisory_sha256! };
    const accepted = await reviewQualityAdvisory(input, advisory, approval);
    assert.equal(accepted.status, 'supervisor_approved_advisory'); assert.equal(accepted.advisory_only, true);
    assert.equal(accepted.automatic_grade_change, false); assert.equal(accepted.automatic_personnel_action, false);
    for (const bad of [{ ...approval, verified: false }, { ...approval, approved: false }, { ...approval, organization_id: 'other' },
      { ...approval, task_id: 'other' }, { ...approval, supervisor_user_id: '' }, { ...approval, advisory_sha256: sha('f') }]) {
      assert.equal((await reviewQualityAdvisory(input, advisory, bad)).status, 'supervisor_review_required');
    }
    advisory.observations[0].text = 'Changed content cannot reuse an old approval.';
    assert.equal((await reviewQualityAdvisory(input, advisory, approval)).status, 'supervisor_review_required');
  }
});
test('uncertain, numeric-score, uncited, unsupported, mismatched or stale output goes to human review', async () => {
  for (const mutate of [
    (a: QualityAdvisory) => { a.disposition = 'uncertain'; },
    (a: QualityAdvisory) => { Object.assign(a, { quality_score: 100 }); },
    (a: QualityAdvisory) => { a.observations = []; },
    (a: QualityAdvisory) => { a.observations[0].criterion_id = 'personnel_fitness'; },
    (a: QualityAdvisory) => { a.observations[0].evidence_item_id = 'not-submitted'; },
    (a: QualityAdvisory) => { a.observations[0].text = ''; },
    (a: QualityAdvisory) => { a.evidence_version = 'old'; },
    (a: QualityAdvisory) => { a.cache_key = sha('f'); },
  ]) {
    const { input, advisory } = await completed(); mutate(advisory);
    assert.equal((await reviewQualityAdvisory(input, advisory)).status, 'human_review');
  }
  const { input, advisory } = await completed(); input.current_evidence.version = 'submission-2';
  assert.equal((await reviewQualityAdvisory(input, advisory)).status, 'human_review');
});
test('malformed runtime inputs fail closed and no policy path performs provider, environment, or database I/O', async () => {
  for (const malformed of [null, {}, { policy: { mode: QUALITY_ADVISORY_MODE } }]) {
    const result = await selectQualityAdvisory(malformed as unknown as QualityAdvisoryInput);
    assert.equal(result.provider_call_allowed, false); assert.equal(result.proposal, undefined);
  }
  const source = readFileSync(new URL('../supabase/functions/_shared/quality-advisory-policy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(fetch|createClient|Deno\.env|process\.env|XMLHttpRequest|WebSocket)\b/);
  assert.doesNotMatch(source, /\b(import|require)\s*[({]/);
});
