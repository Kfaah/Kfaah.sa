/**
 * Pure, default-off planning contract. This module performs no I/O, calls no model,
 * reserves no money, and changes no grades. Its inputs must be server-verified;
 * TypeScript types and approval IDs are not authentication or approval storage.
 */
export const QUALITY_ADVISORY_CONTRACT = 'quality-advisory-policy-v1';
export const QUALITY_ADVISORY_MODE = 'bounded_advisory_v1';

type Sensitivity = 'non_sensitive' | 'regular' | 'sensitive' | 'highly_sensitive' | 'unknown';
export interface EvidenceVersion {
  version: string;
  content_sha256: string;
}
export interface QualityEvidence extends EvidenceVersion {
  submitted: boolean;
  item_ids: string[];
  extracted_chars: number;
  extraction: 'complete' | 'partial' | 'unsupported' | 'ambiguous' | 'empty';
  /** Server classification covers the entire derived payload, including any metadata. */
  sensitivity: Sensitivity;
  data_categories: string[];
  minimized: boolean;
}
export interface QualityRubric {
  id: string;
  version: string;
  content_sha256: string;
  organization_id: string;
  approved: boolean;
  approval_id: string;
  criterion_ids: string[];
  deterministic_check_ids: string[];
  minimum_items: number;
  minimum_extracted_chars: number;
}
export interface QualityAdvisoryPolicy {
  mode: string;
  organization_id: string;
  activation_approval_id: string;
  approved: boolean;
  valid_until: string;
  frequency: 'once_per_submitted_version_and_rubric';
  provider_id: string;
  model_id: string;
  model_revision: string;
  endpoint: string;
  prompt_version: string;
  prompt_sha256: string;
  privacy: {
    approved: boolean;
    approval_id: string;
    organization_id: string;
    provider_id: string;
    endpoint: string;
    purpose: 'work_output_quality_advisory';
    allowed_sensitivities: Array<'non_sensitive' | 'regular' | 'sensitive'>;
    allowed_data_categories: string[];
    valid_until: string;
  };
  pricing: {
    approved: boolean;
    id: string;
    provider_id: string;
    model_id: string;
    model_revision: string;
    currency: string;
    billing: 'bounded_text_tokens';
    all_charges_known: boolean;
    input_micro_units_per_million_tokens: number;
    output_micro_units_per_million_tokens: number;
    fixed_micro_units_per_request: number;
    valid_from: string;
    valid_until: string;
  };
  budget: {
    approved: boolean;
    approval_id: string;
    currency: string;
    period_id: string;
    period_start: string;
    period_end: string;
    per_request_cap_micro_units: number;
    period_cap_micro_units: number;
    max_requests_per_period: number;
    max_input_tokens: number;
    max_output_tokens: number;
    max_input_bytes: number;
  };
}
export interface QualityBudgetSnapshot {
  organization_id: string;
  period_id: string;
  currency: string;
  ledger_version: string;
  complete: boolean;
  spent_micro_units: number;
  reserved_micro_units: number;
  spent_requests: number;
  reserved_requests: number;
}
export interface QualityCacheRecord {
  cache_key: string;
  state: 'completed' | 'reserved' | 'dispatched' | 'unknown' | 'failed';
  advisory_id?: string;
}
export interface QualityAdvisoryInput {
  now: string;
  trigger: string;
  /** Required for manual requests or any changed rubric/model/prompt on old evidence. */
  supervisor_requested?: boolean;
  scope_verified: boolean;
  organization_id: string;
  task_id: string;
  evidence: QualityEvidence;
  current_evidence: EvidenceVersion;
  rubric: QualityRubric;
  deterministic: {
    complete: boolean;
    evidence_version: string;
    evidence_sha256: string;
    rubric_sha256: string;
    checks: Array<{ id: string; status: 'pass' | 'fail' | 'unknown' }>;
    outcome: 'sufficient' | 'semantic_review_needed' | 'ambiguous';
  };
  /** Digest and bounds of the entire minimized text request, including prompt/rubric. */
  payload: {
    sha256: string;
    byte_count: number;
    input_token_upper_bound: number;
    max_output_tokens: number;
    token_bound_verified: boolean;
    kind: 'text_only';
  };
  policy?: QualityAdvisoryPolicy;
  budget_snapshot?: QualityBudgetSnapshot;
  cache_snapshot_complete: boolean;
  cache: QualityCacheRecord[];
  /** Server history: prevents an event replay with changed model/prompt/rubric. */
  prior_attempt_for_evidence: boolean;
}
export type QualitySelectionStatus = 'disabled' | 'not_triggered' | 'rules_sufficient' |
  'human_review' | 'blocked' | 'cached_advisory' | 'await_existing' | 'reservation_proposal';
export interface QualitySelection {
  contract: typeof QUALITY_ADVISORY_CONTRACT;
  status: QualitySelectionStatus;
  reason: string;
  provider_call_allowed: false;
  reserved_micro_units: 0;
  charged_micro_units: 0;
  automatic_grade_change: false;
  requires_supervisor_approval: true;
  cache_key?: string;
  advisory_id?: string;
  proposal?: {
    cache_key: string;
    organization_id: string;
    task_id: string;
    evidence_version: string;
    currency: string;
    period_id: string;
    expected_ledger_version: string;
    pricing_id: string;
    reserve_micro_units: number;
    reserve_requests: 1;
    input_token_upper_bound: number;
    max_output_tokens: number;
    input_bytes: number;
    atomic_reservation_required: true;
    revalidate_before_dispatch: true;
  };
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => natural(value) && value > 0;
const identifiers = (values: unknown): values is string[] => Array.isArray(values) && values.length > 0 && values.every(nonempty) && new Set(values).size === values.length;
function time(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return NaN;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, , zoneHourText, zoneMinuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zoneHour = Number(zoneHourText), zoneMinute = Number(zoneMinuteText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59 ||
      (zone !== 'Z' && (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)))) return NaN;
  return Date.parse(value);
}
const inWindow = (now: number, start: string, end: string) => Number.isFinite(now) && Number.isFinite(time(start)) && Number.isFinite(time(end)) && time(start) <= now && now < time(end);
const sameEvidence = (left: EvidenceVersion, right: EvidenceVersion) => nonempty(left.version) && digest(left.content_sha256) && left.version === right.version && left.content_sha256 === right.content_sha256;
function endpointValid(value: unknown): boolean {
  if (!nonempty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
function decision(status: QualitySelectionStatus, reason: string, extra: Partial<QualitySelection> = {}): QualitySelection {
  return { contract: QUALITY_ADVISORY_CONTRACT, status, reason, provider_call_allowed: false,
    reserved_micro_units: 0, charged_micro_units: 0, automatic_grade_change: false,
    requires_supervisor_approval: true, ...extra };
}
async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Fixed-order tuple avoids delimiter ambiguity; the payload hash binds exact minimized input. */
export async function qualityAdvisoryCacheKey(input: QualityAdvisoryInput): Promise<string> {
  const p = input.policy;
  if (!p) throw new Error('quality_policy_missing');
  return sha256(JSON.stringify([QUALITY_ADVISORY_CONTRACT, input.organization_id, input.task_id,
    input.evidence.version, input.evidence.content_sha256, input.rubric.id, input.rubric.version,
    input.rubric.content_sha256, p.provider_id, p.endpoint, p.model_id, p.model_revision,
    p.prompt_version, p.prompt_sha256, input.payload.sha256, input.payload.max_output_tokens]));
}

/** A conservative maximum, rounded up per billing component; never a live price lookup. */
function reservationCost(input: QualityAdvisoryInput, p: QualityAdvisoryPolicy): number | null {
  const million = 1_000_000n;
  const ceilRate = (tokens: number, rate: number) => (BigInt(tokens) * BigInt(rate) + million - 1n) / million;
  const total = ceilRate(input.payload.input_token_upper_bound, p.pricing.input_micro_units_per_million_tokens) +
    ceilRate(input.payload.max_output_tokens, p.pricing.output_micro_units_per_million_tokens) + BigInt(p.pricing.fixed_micro_units_per_request);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}

/**
 * Produces at most a reservation proposal. A future server must atomically dedupe,
 * compare-and-reserve against its ledger, then revalidate current versions/consent.
 * Neither a proposal nor a repeated pure call authorizes or records a dispatch.
 */
export async function selectQualityAdvisory(input: QualityAdvisoryInput): Promise<QualitySelection> {
  try { return await selectVerified(input); }
  catch { return decision('blocked', 'invalid_or_incomplete_input'); }
}
async function selectVerified(input: QualityAdvisoryInput): Promise<QualitySelection> {
  const p = input?.policy;
  if (!p || p.mode !== QUALITY_ADVISORY_MODE) return decision('disabled', 'advisory_default_off');
  if (!['evidence_submitted', 'supervisor_requested'].includes(input.trigger)) return decision('not_triggered', 'submission_or_explicit_review_only');
  if (input.trigger === 'supervisor_requested' && input.supervisor_requested !== true) return decision('blocked', 'supervisor_request_unverified');
  if (input.scope_verified !== true || !nonempty(input.organization_id) || !nonempty(input.task_id)) return decision('blocked', 'scope_unverified');
  const now = time(input.now);
  if (!Number.isFinite(now) || p.approved !== true || !nonempty(p.activation_approval_id) || p.organization_id !== input.organization_id ||
      !(now < time(p.valid_until)) || p.frequency !== 'once_per_submitted_version_and_rubric') return decision('blocked', 'activation_not_approved');
  const e = input.evidence, rubric = input.rubric;
  if (!sameEvidence(e, input.current_evidence)) return decision('human_review', 'stale_evidence_version');
  if (e.submitted !== true) return decision('not_triggered', 'evidence_not_submitted');
  if (rubric.approved !== true || !nonempty(rubric.approval_id) || rubric.organization_id !== input.organization_id ||
      !nonempty(rubric.id) || !nonempty(rubric.version) || !digest(rubric.content_sha256) || !identifiers(rubric.criterion_ids) || !identifiers(rubric.deterministic_check_ids) ||
      !positive(rubric.minimum_items) || !positive(rubric.minimum_extracted_chars)) return decision('human_review', 'approved_rubric_required');
  if (e.extraction !== 'complete' || !identifiers(e.item_ids) || e.item_ids.length < rubric.minimum_items ||
      !natural(e.extracted_chars) || e.extracted_chars < rubric.minimum_extracted_chars) return decision('human_review', 'insufficient_or_ambiguous_evidence');
  const checks = input.deterministic;
  if (checks.complete !== true || checks.evidence_version !== e.version || checks.evidence_sha256 !== e.content_sha256 ||
      checks.rubric_sha256 !== rubric.content_sha256 || !Array.isArray(checks.checks) || !checks.checks.length ||
      !identifiers(checks.checks.map(check => check.id)) || checks.checks.length !== rubric.deterministic_check_ids.length ||
      checks.checks.some(check => check.status !== 'pass' || !rubric.deterministic_check_ids.includes(check.id))) return decision('human_review', 'deterministic_checks_incomplete_or_failed');
  if (checks.outcome === 'sufficient') return decision('rules_sufficient', 'no_semantic_model_needed');
  if (checks.outcome !== 'semantic_review_needed') return decision('human_review', 'deterministic_ambiguity');
  if (![p.provider_id, p.model_id, p.model_revision, p.prompt_version].every(nonempty) || !digest(p.prompt_sha256) || !endpointValid(p.endpoint)) return decision('blocked', 'provider_model_or_prompt_unapproved');
  const privacy = p.privacy;
  if (privacy.approved !== true || !nonempty(privacy.approval_id) || privacy.organization_id !== input.organization_id ||
      privacy.provider_id !== p.provider_id || privacy.endpoint !== p.endpoint || privacy.purpose !== 'work_output_quality_advisory' ||
      !(now < time(privacy.valid_until)) || e.minimized !== true || !identifiers(e.data_categories) ||
      e.sensitivity === 'unknown' || e.sensitivity === 'highly_sensitive' ||
      !['non_sensitive', 'regular', 'sensitive'].includes(e.sensitivity) || !privacy.allowed_sensitivities.includes(e.sensitivity) ||
      !identifiers(privacy.allowed_data_categories) || !e.data_categories.every(category => privacy.allowed_data_categories.includes(category))) return decision('blocked', 'data_recipient_approval_required');
  const price = p.pricing, budget = p.budget;
  if (price.approved !== true || !nonempty(price.id) || price.provider_id !== p.provider_id || price.model_id !== p.model_id ||
      price.model_revision !== p.model_revision || price.billing !== 'bounded_text_tokens' || price.all_charges_known !== true ||
      !/^[A-Z]{3}$/.test(price.currency) || !inWindow(now, price.valid_from, price.valid_until) ||
      ![price.input_micro_units_per_million_tokens, price.output_micro_units_per_million_tokens, price.fixed_micro_units_per_request].every(natural)) return decision('blocked', 'approved_current_complete_price_required');
  if (budget.approved !== true || !nonempty(budget.approval_id) || !nonempty(budget.period_id) || budget.currency !== price.currency ||
      !inWindow(now, budget.period_start, budget.period_end) || ![budget.per_request_cap_micro_units, budget.period_cap_micro_units].every(natural) ||
      ![budget.max_requests_per_period, budget.max_input_tokens, budget.max_output_tokens, budget.max_input_bytes].every(positive)) return decision('blocked', 'approved_bounded_budget_required');
  const payload = input.payload;
  if (!digest(payload.sha256) || payload.kind !== 'text_only' || payload.token_bound_verified !== true ||
      ![payload.byte_count, payload.input_token_upper_bound, payload.max_output_tokens].every(positive) ||
      payload.byte_count > budget.max_input_bytes || payload.input_token_upper_bound > budget.max_input_tokens ||
      payload.max_output_tokens > budget.max_output_tokens) return decision('blocked', 'input_or_output_bounds_invalid');
  const cacheKey = await qualityAdvisoryCacheKey(input);
  if (input.cache_snapshot_complete !== true || !Array.isArray(input.cache) || typeof input.prior_attempt_for_evidence !== 'boolean') return decision('blocked', 'authoritative_cache_history_required');
  const matches = input.cache.filter(record => record.cache_key === cacheKey);
  if (matches.length > 1) return decision('blocked', 'cache_state_conflict', { cache_key: cacheKey });
  const existing = matches[0];
  if (existing?.state === 'completed' && nonempty(existing.advisory_id)) return decision('cached_advisory', 'reuse_without_new_charge', { cache_key: cacheKey, advisory_id: existing.advisory_id });
  if (existing && ['reserved', 'dispatched', 'unknown'].includes(existing.state)) return decision('await_existing', 'do_not_duplicate_or_release_uncertain_reservation', { cache_key: cacheKey });
  if (existing) return decision('human_review', 'prior_failure_or_invalid_result_no_automatic_retry', { cache_key: cacheKey });
  if (input.prior_attempt_for_evidence && input.supervisor_requested !== true) return decision('human_review', 'changed_configuration_requires_explicit_review', { cache_key: cacheKey });
  const ledger = input.budget_snapshot;
  if (!ledger || ledger.complete !== true || ledger.organization_id !== input.organization_id || ledger.period_id !== budget.period_id ||
      ledger.currency !== budget.currency || !nonempty(ledger.ledger_version) ||
      ![ledger.spent_micro_units, ledger.reserved_micro_units, ledger.spent_requests, ledger.reserved_requests].every(natural)) return decision('blocked', 'authoritative_budget_snapshot_required', { cache_key: cacheKey });
  const reserve = reservationCost(input, p);
  if (reserve === null || reserve > budget.per_request_cap_micro_units) return decision('blocked', 'per_request_spend_cap', { cache_key: cacheKey });
  if (BigInt(ledger.spent_micro_units) + BigInt(ledger.reserved_micro_units) + BigInt(reserve) > BigInt(budget.period_cap_micro_units)) return decision('blocked', 'period_spend_cap', { cache_key: cacheKey });
  if (BigInt(ledger.spent_requests) + BigInt(ledger.reserved_requests) + 1n > BigInt(budget.max_requests_per_period)) return decision('blocked', 'period_request_cap', { cache_key: cacheKey });
  return decision('reservation_proposal', 'eligible_only_after_atomic_reservation_and_revalidation', {
    cache_key: cacheKey,
    proposal: { cache_key: cacheKey, organization_id: input.organization_id, task_id: input.task_id, evidence_version: e.version,
      currency: budget.currency, period_id: budget.period_id, expected_ledger_version: ledger.ledger_version, pricing_id: price.id,
      reserve_micro_units: reserve, reserve_requests: 1, input_token_upper_bound: payload.input_token_upper_bound,
      max_output_tokens: payload.max_output_tokens, input_bytes: payload.byte_count,
      atomic_reservation_required: true, revalidate_before_dispatch: true },
  });
}

export interface QualityAdvisory {
  id: string;
  cache_key: string;
  evidence_version: string;
  evidence_sha256: string;
  rubric_sha256: string;
  disposition: 'positive' | 'negative' | 'mixed' | 'uncertain';
  observations: Array<{ criterion_id: string; evidence_item_id: string; text: string }>;
}
export interface QualitySupervisorApproval {
  approved: boolean;
  verified: boolean;
  supervisor_user_id: string;
  organization_id: string;
  task_id: string;
  /** Binds the entire exact advisory, rather than only its reusable ID. */
  advisory_sha256: string;
}
export interface QualityAdvisoryReview {
  status: 'human_review' | 'supervisor_review_required' | 'supervisor_approved_advisory';
  reason: string;
  advisory_only: true;
  automatic_grade_change: false;
  automatic_personnel_action: false;
  advisory_sha256?: string;
}

/** Both favorable and unfavorable observations require the same human approval. No score API. */
export async function reviewQualityAdvisory(input: QualityAdvisoryInput, advisory: QualityAdvisory, approval?: QualitySupervisorApproval): Promise<QualityAdvisoryReview> {
  const result = (status: QualityAdvisoryReview['status'], reason: string, hash?: string): QualityAdvisoryReview => ({ status, reason,
    advisory_only: true, automatic_grade_change: false, automatic_personnel_action: false, ...(hash ? { advisory_sha256: hash } : {}) });
  try {
    const selection = await selectQualityAdvisory(input);
    if (selection.status !== 'cached_advisory' || selection.advisory_id !== advisory.id) return result('human_review', 'verified_completed_cache_required');
    if (advisory.cache_key !== selection.cache_key || advisory.evidence_version !== input.current_evidence.version ||
        advisory.evidence_sha256 !== input.current_evidence.content_sha256 || advisory.rubric_sha256 !== input.rubric.content_sha256) return result('human_review', 'stale_or_mismatched_advisory');
    const fields = ['id', 'cache_key', 'evidence_version', 'evidence_sha256', 'rubric_sha256', 'disposition', 'observations'];
    if (Object.keys(advisory).some(key => !fields.includes(key)) || !['positive', 'negative', 'mixed'].includes(advisory.disposition) ||
        !Array.isArray(advisory.observations) || !advisory.observations.length || advisory.observations.length > 100 ||
        advisory.observations.some(observation => Object.keys(observation).some(key => !['criterion_id', 'evidence_item_id', 'text'].includes(key)) ||
          !input.rubric.criterion_ids.includes(observation.criterion_id) || !input.evidence.item_ids.includes(observation.evidence_item_id) ||
          !nonempty(observation.text) || observation.text.length > 4000)) return result('human_review', 'ambiguous_or_unsupported_output');
    const hash = await sha256(JSON.stringify([QUALITY_ADVISORY_CONTRACT, advisory.id, advisory.cache_key,
      advisory.evidence_version, advisory.evidence_sha256, advisory.rubric_sha256, advisory.disposition,
      advisory.observations.map(observation => [observation.criterion_id, observation.evidence_item_id, observation.text])]));
    if (!approval || approval.approved !== true || approval.verified !== true || !nonempty(approval.supervisor_user_id) ||
        approval.organization_id !== input.organization_id || approval.task_id !== input.task_id || approval.advisory_sha256 !== hash) return result('supervisor_review_required', 'exact_current_advisory_requires_supervisor_approval', hash);
    return result('supervisor_approved_advisory', 'separate_work_output_advisory_only', hash);
  } catch { return result('human_review', 'invalid_or_incomplete_output'); }
}
