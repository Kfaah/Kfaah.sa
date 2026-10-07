/**
 * Deterministic finance, campaign and reporting previews. No I/O, clock, random
 * values, persistence, recipients, inferred budgets or model-generated facts.
 * Authentication and complete reads belong to the caller. This module checks
 * row organization scope again and labels request aggregates as unverified.
 */
import { calendarDate, parseMoneyToCents, parseNonNegativeInteger, percentage } from './rule-analysis.ts';

export const BUSINESS_RULE_SOURCE = 'rules-v1' as const;
export const BUSINESS_ROUTES = [
  'classify-expense-batch', 'suggest-finance-reports', 'report-suggestions',
  'marketing-evaluate-campaign', 'marketing-design-brief', 'marketing-generate-content',
  'marketing-suggest-campaigns', 'innovation-suggestions', 'executive-report', 'admin-insights',
] as const;
export type BusinessRow = Record<string, unknown>;
export type BusinessVerifiedData = {
  organizationId?: string;
  organization_id?: string;
  organization?: BusinessRow;
  expenses?: BusinessRow[];
  donations?: BusinessRow[];
  projects?: BusinessRow[];
  projectDataset?: 'projects_catalog' | 'projects';
  campaign?: BusinessRow;
  campaignMetrics?: BusinessRow[];
  campaign_metrics?: BusinessRow[];
  metrics?: BusinessRow;
  summary?: BusinessRow;
  /** Set only from an established storage contract, never from a guess. */
  currency?: string;
  /** Multiple readings are not additive unless the caller establishes grain. */
  metricMode?: 'increments' | 'snapshot';
};
type Proof = { source: 'rules-v1'; dataset: string; rule_id: string; organization_id: string | null; row_ids: string[]; row_count: number; row_ids_truncated: boolean; period?: BusinessRow | null; source_evidence?: BusinessRow[]; facts: BusinessRow; input_kind: 'verified_records' | 'supplied_input' | 'template' };
type Issue = { code: string; dataset: string; row_id?: string; field?: string };
const rec = (v: unknown): BusinessRow => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as BusinessRow : {};
const str = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const arr = (v: unknown): BusinessRow[] => Array.isArray(v) ? v.map(rec) : [];
const own = (v: BusinessRow, k: string) => Object.prototype.hasOwnProperty.call(v, k);
const number = (v: unknown): number | null => {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const s = String(v).trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/٫/g, '.');
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER ? n : null;
};
const rounded = (v: number): number => Math.round(v * 100) / 100;
const fmt = (v: number | null) => v === null ? 'غير متاح' : String(v);
const orgId = (data: BusinessVerifiedData) => str(data.organizationId || data.organization_id);
const currency = (v: unknown): string | null => /^[A-Z]{3}$/.test(str(v).toUpperCase()) ? str(v).toUpperCase() : null;
const stable = (v: unknown): string => JSON.stringify(v !== null && typeof v === 'object' ? Array.isArray(v) ? v.map(x => JSON.parse(stable(x))) : Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, x === undefined ? null : JSON.parse(stable(x))])) : v ?? null);
function proof(dataset: string, rule: string, data: BusinessVerifiedData, rows: BusinessRow[] = [], facts: BusinessRow = {}, kind: Proof['input_kind'] = 'verified_records'): Proof {
  return { source: BUSINESS_RULE_SOURCE, dataset, rule_id: rule, organization_id: orgId(data) || null, row_ids: rows.map(r => str(r.id)).filter(Boolean).sort().slice(0, 200), row_count: rows.length, row_ids_truncated: rows.length > 200, facts, input_kind: kind };
}
function meta(evidence: Proof[], limits: string[] = [], issues: Issue[] = []) {
  return { source: BUSINESS_RULE_SOURCE, preview_only: true, writes_enabled: false, messages_sent: 0, evidence, limitations: [...new Set(limits)], quality: { issues: issues.slice(0, 200), issue_count: issues.length, issues_truncated: issues.length > 200, needs_review: issues.length > 0 } };
}
function scopedRows(value: unknown, dataset: string, data: BusinessVerifiedData, issues: Issue[]): BusinessRow[] {
  const groups = new Map<string, BusinessRow[]>();
  for (const row of arr(value)) {
    const id = str(row.id);
    if (!orgId(data) || row.organization_id !== orgId(data)) { issues.push({ code: 'organization_scope_mismatch', dataset, row_id: id }); continue; }
    if (!id) { issues.push({ code: 'missing_row_identity', dataset }); continue; }
    if (row.ai_generated === true || row.source === 'ai' || row.source === 'historical_ai') { issues.push({ code: 'historical_ai_excluded', dataset, row_id: id }); continue; }
    groups.set(id, [...(groups.get(id) || []), row]);
  }
  const result: BusinessRow[] = [];
  for (const [id, copies] of [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (new Set(copies.map(stable)).size > 1) { issues.push({ code: 'conflicting_duplicate', dataset, row_id: id }); continue; }
    if (copies.length > 1) issues.push({ code: 'duplicate_excluded', dataset, row_id: id });
    result.push(copies[0]);
  }
  return result;
}
function safeSum(values: number[]): number | null {
  let sum = 0;
  for (const n of values) { sum += n; if (!Number.isSafeInteger(sum)) return null; }
  return sum;
}
function moneyTotal(rows: BusinessRow[], field: string, data: BusinessVerifiedData, issues: Issue[], dataset: string) {
  const fallback = currency(data.currency);
  const codes = rows.map(r => currency(r.currency) || (r.currency == null || r.currency === '' ? fallback : null));
  const parsed = rows.map(r => parseMoneyToCents(r[field]));
  const complete = rows.length > 0 && codes.every(Boolean) && new Set(codes).size === 1 && parsed.every(n => n !== null);
  if (rows.length && !codes.every(Boolean)) issues.push({ code: 'currency_missing_or_invalid', dataset, field });
  if (new Set(codes.filter(Boolean)).size > 1) issues.push({ code: 'mixed_currencies', dataset, field });
  if (parsed.some(n => n === null)) issues.push({ code: 'invalid_amount', dataset, field });
  const cents = complete ? safeSum(parsed as number[]) : null;
  if (complete && cents === null) issues.push({ code: 'amount_overflow', dataset, field });
  return { amount: cents === null ? null : cents / 100, cents, currency: complete ? codes[0] : null };
}

const normalize = (value: unknown) => str(value).normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const phrase = (haystack: string, needle: string) => !!needle && ([needle, ...(/^[\u0621-\u064a]/.test(needle) ? ['و', 'ف', 'ب', 'ل', 'وب', 'ول'].map(prefix => prefix + needle) : [])]).some(form => (` ${haystack} `).includes(` ${form} `));
const EXPENSE_KEYWORDS = {
  marketing: ['إعلان', 'إعلانات', 'الإعلانات', 'تسويق', 'التسويق', 'حملة إعلانية', 'تصميم إعلاني', 'advertising', 'marketing', 'ad spend'],
  operational: ['إيجار', 'الإيجار', 'رواتب', 'الرواتب', 'كهرباء', 'الكهرباء', 'إنترنت', 'قرطاسية', 'مستلزمات مكتبية', 'rent', 'salary', 'salaries', 'utilities', 'office supplies'],
  project: ['تنفيذ مشروع', 'مستلزمات مشروع', 'مساعدات المستفيدين', 'سلال غذائية', 'كفالة يتيم', 'project delivery'],
} as const;
export function classifyExpenses(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), issues: Issue[] = [];
  const projects = [...new Set((Array.isArray(payload.projects) ? payload.projects : []).map(str).filter(Boolean))].sort();
  const rows = arr(payload.rows);
  const classifications = rows.map((row, i) => {
    const description = normalize(row.description);
    const matched = Object.entries(EXPENSE_KEYWORDS).flatMap(([kind, words]) => words.filter(word => phrase(description, normalize(word))).map(word => ({ kind, keyword: word })));
    const matchingProjects = projects.filter(name => phrase(description, normalize(name)));
    const candidates = [...new Set([...matched.map(m => m.kind), ...(matchingProjects.length ? ['project'] : [])])].sort();
    const reasons: string[] = [];
    if (!description) reasons.push('missing_description');
    if (!candidates.length) reasons.push('no_unambiguous_keyword');
    if (candidates.length > 1) reasons.push('conflicting_categories');
    if (matchingProjects.length > 1) reasons.push('multiple_projects');
    // Negated descriptions require human reading instead of guessing intent.
    if (/\b(?:not|without|except)\b/.test(description) || /(?:^| )(?:ليس|ليست|بدون|عدا|باستثناء|غير)(?: |$)/u.test(description)) reasons.push('negated_description');
    if (own(row, 'amount') && parseMoneyToCents(row.amount) === null) reasons.push('invalid_amount');
    const needsReview = reasons.length > 0;
    const evidence = proof('request.rows', 'expense-keywords-v1', data, [], { row_index: i + 1, matched_keywords: matched, project_matches: matchingProjects, classification_basis: 'description_only' }, 'supplied_input');
    return { index: i + 1, id: str(row.id) || null, kind: needsReview ? null : candidates[0], project_name: !needsReview && matchingProjects.length === 1 ? matchingProjects[0] : null, confidence: null, needs_review: needsReview, status: needsReview ? 'needs_review' : 'rule_match', reasons, evidence };
  });
  return { ...meta(classifications.map(x => x.evidence), ['مطابقة كلمات صريحة في الوصف وليست حكماً محاسبياً. المورد وحده لا يحدد التصنيف. لا تُستبدل الفئة غير المحسومة بتشغيلي.'], issues), classifications, classified_count: classifications.filter(x => !x.needs_review).length, review_count: classifications.filter(x => x.needs_review).length };
}

type FinanceSuggestion = { id: string; title: string; description: string; audience: string; benefit: string; category: string; priority: number; rule_id: string; evidence: Proof };
export function suggestFinanceReports(data: BusinessVerifiedData = {}) {
  const issues: Issue[] = [];
  const expenses = scopedRows(data.expenses, 'expenses', data, issues);
  const donations = scopedRows(data.donations, 'donations', data, issues).filter(r => ['success', 'successful', 'paid', 'completed'].includes(str(r.status)));
  const exp = moneyTotal(expenses, 'amount', data, issues, 'expenses'), don = moneyTotal(donations, 'amount', data, issues, 'donations');
  const suggestions: FinanceSuggestion[] = [];
  const add = (id: string, title: string, description: string, category: string, priority: number, rows: BusinessRow[], facts: BusinessRow = {}) => suggestions.push({ id, title, description, audience: category === 'donor' ? 'فريق علاقات المتبرعين' : 'الإدارة المالية والتنفيذية', benefit: 'إتاحة مراجعة قابلة للتتبع قبل اتخاذ قرار أو نشر تقرير.', category, priority, rule_id: id, evidence: proof(category === 'donor' ? 'donations' : 'expenses', id, data, rows, facts) });
  if (expenses.length) add('expense-register', 'سجل المصروفات والتصنيف', `مراجعة ${expenses.length} مصروفاً مسجلاً، مع إظهار الفئة والمشروع وحالة الاعتماد.`, 'operational', 9, expenses, { expense_count: expenses.length });
  if (donations.length) add('successful-donations-register', 'سجل التبرعات الناجحة', `تقرير عن ${donations.length} عملية ناجحة دون إدراج المدفوعات المعلقة أو الفاشلة.`, 'donor', 8, donations, { successful_donations: donations.length });
  if (exp.cents !== null) add('expense-allocation', 'توزيع المصروفات حسب الفئة', `توزيع المبالغ الموثقة (${exp.amount} ${exp.currency}) مع فصل غير المصنف.`, 'executive', 8, expenses, { total_cents: exp.cents, currency: exp.currency });
  if (don.cents !== null) add('donation-income', 'تفصيل مبالغ التبرعات الناجحة', `مراجعة ${don.amount} ${don.currency} موزعة حسب المشاريع المسجلة.`, 'donor', 8, donations, { total_cents: don.cents, currency: don.currency });
  if (exp.cents !== null && don.cents !== null && exp.currency === don.currency) add('recorded-income-expense', 'مقارنة التبرعات والمصروفات المسجلة', 'مقارنة السجلين ضمن الفترة نفسها. لا يمثل الفرق رصيد البنك أو قائمة تدفقات نقدية مدققة.', 'executive', 7, [...expenses, ...donations], { donations_cents: don.cents, expenses_cents: exp.cents, currency: exp.currency });
  const projectRows = expenses.filter(r => str(r.project_name) || str(r.project_id));
  if (projectRows.length) add('project-cost-register', 'سجل تكلفة المشاريع', 'تفصيل المصروفات المرتبطة صراحة بمشروع؛ لا تُوزع المصروفات المشتركة دون سياسة معتمدة.', 'project', 7, projectRows, { linked_expenses: projectRows.length });
  const marketing = expenses.filter(r => r.kind === 'marketing');
  if (marketing.length) add('marketing-spend-register', 'سجل المصروفات التسويقية', 'مراجعة المصروفات المصنفة تسويقياً؛ لا يُستنتج العائد أو أثر الحملة من التصنيف وحده.', 'marketing', 6, marketing, { marketing_expense_count: marketing.length });
  const dated = expenses.filter(r => calendarDate(r.expense_date) !== null);
  if (dated.length === expenses.length && dated.length && exp.cents !== null) add('monthly-expense-register', 'التوزيع الشهري للمصروفات', 'تجميع المصروفات بحسب شهر التاريخ المسجل، مع عرض الأشهر التي توجد لها بيانات فقط.', 'operational', 6, dated, { expense_count: dated.length });
  if (issues.length) add('finance-data-quality', 'مراجعة اكتمال البيانات المالية', 'استكمال العملة والقيم الصالحة وهوية السجل قبل اعتماد المقارنات المالية.', 'operational', 10, [], { issue_codes: [...new Set(issues.map(i => i.code))].sort() });
  suggestions.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  return { ...meta(suggestions.map(s => s.evidence), ['كتالوج محدود يختار التقارير الممكنة من البيانات المتاحة، دون افتراض عدد إلزامي من الاقتراحات.', 'المعاينة لا تحفظ الاقتراحات ولا تستبدل تقارير سابقة.'], issues), suggestions, count: suggestions.length, financial_totals: { expenses: exp, donations: don }, status: suggestions.length ? 'preview' : 'insufficient_data' };
}

function campaignRecord(data: BusinessVerifiedData, payload: BusinessRow, issues: Issue[]): BusinessRow | null {
  const campaign = rec(data.campaign);
  if (!str(campaign.id) || !orgId(data) || campaign.organization_id !== orgId(data) || (str(payload.campaign_id) && payload.campaign_id !== campaign.id)) {
    issues.push({ code: 'campaign_not_in_verified_scope', dataset: 'marketing_campaigns' }); return null;
  }
  return campaign;
}
function aggregateCampaignMetrics(rows: BusinessRow[], data: BusinessVerifiedData, issues: Issue[]) {
  const result: Record<string, number | null> = {};
  for (const field of ['impressions', 'clicks', 'conversions', 'donations_count']) {
    const values = rows.map(r => parseNonNegativeInteger(r[field]));
    result[field] = rows.length && values.every(v => v !== null) ? safeSum(values as number[]) : null;
    if (rows.length && result[field] === null) issues.push({ code: 'metric_missing_invalid_or_overflow', dataset: 'marketing_campaign_metrics', field });
  }
  const revenue = moneyTotal(rows, 'donations_amount', data, issues, 'marketing_campaign_metrics');
  const spend = moneyTotal(rows, 'cost', data, issues, 'marketing_campaign_metrics');
  const sameCurrency = revenue.currency !== null && revenue.currency === spend.currency;
  return { impressions: result.impressions, clicks: result.clicks, conversions: result.conversions, donations_count: result.donations_count, donations_amount: revenue.amount, cost: spend.amount, revenue_cents: revenue.cents, cost_cents: spend.cents, currency: sameCurrency ? revenue.currency : null };
}
export function evaluateCampaign(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), issues: Issue[] = [];
  const campaign = campaignRecord(data, payload, issues);
  let readings = scopedRows(data.campaignMetrics ?? data.campaign_metrics, 'marketing_campaign_metrics', data, issues).filter(r => {
    if (campaign && r.campaign_id === campaign.id) return true;
    issues.push({ code: 'campaign_scope_mismatch', dataset: 'marketing_campaign_metrics', row_id: str(r.id) }); return false;
  });
  const sourceReadings = [...readings];
  if (data.metricMode === 'snapshot') {
    const mixedScope = readings.some(r => !str(r.channel)) && readings.some(r => !!str(r.channel));
    if (mixedScope) { issues.push({ code: 'snapshot_channel_scope_ambiguous', dataset: 'marketing_campaign_metrics' }); readings = []; }
    const groups = new Map<string, BusinessRow[]>();
    readings.forEach(r => { const key = str(r.channel) || '[unassigned]'; groups.set(key, [...(groups.get(key) || []), r]); });
    readings = [];
    for (const rows of groups.values()) {
      const valid = rows.every(r => typeof r.measured_at === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(r.measured_at) && Number.isFinite(Date.parse(r.measured_at)) && calendarDate(r.measured_at.slice(0, 10)) !== null);
      if (!valid) { issues.push({ code: 'snapshot_time_missing', dataset: 'marketing_campaign_metrics' }); continue; }
      const latestTime = Math.max(...rows.map(r => Date.parse(str(r.measured_at))));
      const latest = rows.filter(r => Date.parse(str(r.measured_at)) === latestTime);
      if (latest.length !== 1) { issues.push({ code: 'snapshot_time_conflict', dataset: 'marketing_campaign_metrics' }); continue; }
      readings.push(latest[0]);
    }
  } else if (data.metricMode !== 'increments' && readings.length > 1) {
    issues.push({ code: 'metric_grain_required', dataset: 'marketing_campaign_metrics' }); readings = [];
  }
  // A failed or excluded snapshot group makes campaign totals incomplete.
  if (issues.some(i => ['snapshot_time_missing', 'snapshot_time_conflict', 'conflicting_duplicate'].includes(i.code))) readings = [];
  const totals = aggregateCampaignMetrics(readings, data, issues);
  const pct = (a: number | null, b: number | null) => a !== null && b !== null ? percentage(a, b) : null;
  const conversionRate = pct(totals.conversions, totals.clicks);
  const ctr = pct(totals.clicks, totals.impressions);
  const roi = totals.currency && totals.cost_cents !== null && totals.cost_cents > 0 && totals.revenue_cents !== null ? rounded((totals.revenue_cents - totals.cost_cents) / totals.cost_cents * 100) : null;
  const roas = totals.currency && totals.cost_cents !== null && totals.cost_cents > 0 && totals.revenue_cents !== null ? rounded(totals.revenue_cents / totals.cost_cents) : null;
  const cpd = totals.currency && totals.cost_cents !== null && totals.donations_count !== null && totals.donations_count > 0 ? rounded(totals.cost_cents / 100 / totals.donations_count) : null;
  const recommendations: { action: string; why: string; priority: 'high' | 'medium' | 'low' }[] = [];
  if (issues.length || !readings.length) recommendations.push({ action: 'تحقق من اكتمال القراءات وعملتها وطريقة تجميعها.', why: 'لا تُعامل البيانات المفقودة أو المتداخلة كأصفار.', priority: 'high' });
  if (totals.clicks !== null && totals.clicks > 0 && totals.conversions === 0) recommendations.push({ action: 'اختبر تسجيل التحويلات ورحلة التبرع قبل تغيير الرسالة.', why: `توجد ${totals.clicks} نقرة و0 تحويلات مسجلة؛ السبب غير محدد في هذه البيانات.`, priority: 'high' });
  if (totals.cost_cents === 0) recommendations.push({ action: 'أكد أن تكلفة الحملة مسجلة بالكامل.', why: 'التكلفة المسجلة صفر، لذا لا يمكن حساب العائد النسبي على الإنفاق.', priority: 'medium' });
  const expected = campaign?.ai_generated === true ? {} : rec(campaign?.expected_kpis);
  const comparisons = (['impressions', 'clicks', 'conversions', 'donations_count'] as const).flatMap(key => {
    const target = parseNonNegativeInteger(expected[key]), actual = totals[key];
    return target !== null && actual !== null ? [{ metric: key, actual, target, attainment_percent: percentage(actual, target) }] : [];
  });
  const strengths = comparisons.filter(c => c.target > 0 && c.actual >= c.target).map(c => `${c.metric}: المسجل ${c.actual} مقابل الهدف المدخل ${c.target}.`);
  const weaknesses = comparisons.filter(c => c.target > 0 && c.actual < c.target).map(c => `${c.metric}: المسجل ${c.actual} مقابل الهدف المدخل ${c.target}؛ لا تحدد المقارنة سبب الفرق.`);
  const evidence = proof('marketing_campaign_metrics', 'campaign-arithmetic-v1', data, readings, { totals, comparisons, aggregation: data.metricMode || 'single_reading', excluded_readings: sourceReadings.length - readings.length });
  const evaluation = {
    overall_grade: 'يحتاج مراجعة بشرية', grade_status: 'needs_review',
    summary: `ملخص وصفي لـ${str(campaign?.name) || '[اسم الحملة]'}: ${readings.length} قراءة مستخدمة. النقرات: ${fmt(totals.clicks)}، التحويلات: ${fmt(totals.conversions)}، التبرعات: ${fmt(totals.donations_count)}. الأرقام المسجلة لا تثبت أن الحملة سببت التبرع.`,
    kpi_analysis: { reach_vs_expected: 'لا تُعامل مرات الظهور كوصول فريد. يلزم مقياس وصول مطابق للمستهدف.', conversion_rate: conversionRate === null ? 'غير متاح: يلزم عدد تحويلات وعدد نقرات أكبر من صفر.' : `${conversionRate}% (التحويلات ÷ النقرات)`, conversion_rate_pct: conversionRate, click_through_rate_pct: ctr, roi_pct: roi, roas, cost_per_donation: cpd, currency: totals.currency, roi_definition: '(التبرعات المسجلة − التكلفة المسجلة) ÷ التكلفة × 100؛ ليس تقديراً للأثر السببي أو الربح المحاسبي.' },
    strengths, weaknesses, recommendations, comparisons, best_channel: null, worst_channel: null, playbook_insights: [], evidence,
  };
  return { ...meta([evidence], ['لا توجد درجة نوعية أو قناة أفضل دون سياسة مقارنة معتمدة وعينات قابلة للمقارنة.', 'القسمة على صفر والقيم المفقودة تعرض كغير متاحة.', 'لا تستخدم التقييمات السابقة أو ذاكرة مولدة آلياً كدليل، ولا يُحفظ التقييم أو الدروس.'], issues), evaluation, totals, status: readings.length ? 'preview' : 'insufficient_data' };
}

const CHANNELS = ['whatsapp', 'sms', 'email', 'x', 'instagram', 'snapchat', 'tiktok', 'youtube', 'meta_ads', 'google_ads'] as const;
const placeholdersIn = (value: unknown): string[] => [...new Set((JSON.stringify(value).match(/\[[^[\]\n]{1,100}\]/g) || []))].sort();
function campaignTextContext(payload: BusinessRow, data: BusinessVerifiedData, issues: Issue[]) {
  const campaign = campaignRecord(data, payload, issues);
  const usable = campaign && campaign.ai_generated !== true && campaign.source !== 'ai' && campaign.source !== 'historical_ai';
  if (campaign && !usable) issues.push({ code: 'historical_ai_copy_excluded', dataset: 'marketing_campaigns', row_id: str(campaign.id) });
  const clean = (v: unknown, fallback: string, max = 100) => {
    const value = str(v).replace(/\p{Cc}/gu, ' ');
    return value && value.length <= max ? value : fallback;
  };
  return { campaign, name: usable ? clean(campaign.name, '[اسم الحملة]') : '[اسم الحملة]', project: usable ? clean(campaign.related_project, '[اسم المشروع]') : '[اسم المشروع]', organization: clean(data.organization?.name, '[اسم الجمعية]'), usable };
}
export function generateMarketingContent(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), issues: Issue[] = [];
  const ctx = campaignTextContext(payload, data, issues), channel = str(payload.channel);
  const allowed = (CHANNELS as readonly string[]).includes(channel);
  const base = `تعرّف على ${ctx.project} ضمن ${ctx.name}.`;
  const link = '[رابط التبرع المعتمد]';
  const variants: { label: string; body: string; hashtags: string[]; cta: string; headlines?: string[]; descriptions?: string[] }[] = [];
  if (!allowed) issues.push({ code: 'unsupported_channel', dataset: 'request', field: 'channel' });
  else if (channel === 'google_ads') {
    variants.push({ label: 'قالب إعلان بحث للمراجعة', body: 'تعرّف على المشروع\nاطّلع على تفاصيله\nساهم عبر الرابط المعتمد\n[الرابط المعتمد]', headlines: ['تعرّف على المشروع', 'اطّلع على تفاصيله', 'ساهم عبر الرابط المعتمد'], descriptions: ['تفاصيل المشروع ووسائل المساهمة عبر الصفحة المعتمدة للجمعية.', 'راجع تفاصيل المشروع قبل المساهمة.'], hashtags: [], cta: '[الرابط المعتمد]' });
  } else if (channel === 'sms' || channel === 'x' || channel === 'snapchat') {
    const limit = channel === 'x' ? 280 : 160;
    const body = `${base}\nالتفاصيل والمساهمة: ${link}`;
    // Never truncate a URL, name or placeholder to enforce a channel limit.
    variants.push({ label: 'قالب موجز', body: [...body].length <= limit ? body : `تعرّف على [المشروع] وطرق المساهمة: ${link}`, hashtags: [], cta: link });
  } else if (channel === 'tiktok' || channel === 'youtube') {
    variants.push({ label: 'قالب فيديو بلا قصة مختلقة', body: `افتتاحية: ${base}\nعرض: [وصف النشاط الموثق وصور مصرح باستخدامها]\nبيانات: [معلومة أثر موثقة مع مصدرها، أو احذف هذا الجزء]\nختام: التفاصيل ووسائل المساهمة عبر ${link}`, hashtags: [], cta: link });
  } else if (channel === 'email') {
    variants.push({ label: 'رسالة تعريفية للمراجعة', body: `الموضوع: تفاصيل ${ctx.name}\n\nمرحباً [اسم المستلم بعد مراجعة الموافقة]،\n${base}\nيمكنك الاطلاع على وصف المشروع وآلية المساهمة في الصفحة المعتمدة: ${link}\n\nمع التقدير،\n${ctx.organization}\n[طريقة إلغاء الاشتراك المعتمدة]`, hashtags: [], cta: link });
  } else {
    variants.push({ label: 'تعريف بالمشروع', body: `${base}\nاطّلع على التفاصيل وطرق المساهمة: ${link}`, hashtags: [], cta: link });
    variants.push({ label: 'دعوة للاطلاع', body: `ما الذي يقدمه ${ctx.project}؟\n[وصف مختصر موثق للمشروع]\nالتفاصيل عبر ${link}`, hashtags: [], cta: link });
    variants.push({ label: 'قالب عرض معلومة موثقة', body: `${ctx.name}\n[معلومة موثقة عن المشروع مع مصدرها]\nللتعرّف على المشروع ووسائل المساهمة: ${link}`, hashtags: [], cta: link });
  }
  const evidence = proof('marketing_campaigns', `marketing-copy-${channel || 'unknown'}-v1`, data, ctx.campaign ? [ctx.campaign] : [], { fields_used: ctx.usable ? ['name', 'related_project'] : [], channel }, 'template');
  return { ...meta([evidence], ['قوالب عربية ثابتة للمراجعة؛ ليست اعتماداً للمحتوى أو موافقة على التواصل.', 'يجب استكمال الحقول ومراجعة الرابط وموافقة المستلمين وسياسة القناة قبل النشر.', 'لا تنفذ الملاحظات الحرة كتعليمات ولا تضيف ادعاءات أثر أو أرقاماً أو قصص مستفيدين.'], issues), variants, placeholders: placeholdersIn(variants), requires_approval: true, extra_instructions_applied: false, tone: 'فصحى مهنية محايدة', status: allowed ? 'draft' : 'needs_review' };
}
export function generateDesignBrief(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), issues: Issue[] = [];
  const ctx = campaignTextContext(payload, data, issues);
  const type = str(payload.brief_type) || 'design';
  if (!['design', 'video', 'motion'].includes(type)) issues.push({ code: 'unsupported_brief_type', dataset: 'request', field: 'brief_type' });
  const moving = type === 'video' || type === 'motion';
  const brief = {
    title: `مسودة بريف ${type === 'design' ? 'تصميم' : type === 'video' ? 'فيديو' : 'موشن'}: ${ctx.name}`,
    concept: `تعريف واضح بـ${ctx.project} باستخدام مواد موثقة، مع دعوة للاطلاع على صفحة المشروع المعتمدة.`,
    visual_direction: 'تسلسل قراءة عربي واضح: اسم المشروع، وصف موثق، دعوة للمساهمة. راجع التباين وإمكانية قراءة النص على شاشة صغيرة.',
    color_palette: ['[لون أساسي من دليل الهوية المعتمد]', '[لون مساعد من دليل الهوية المعتمد]'],
    typography: '[الخط العربي المرخص والمعتمد في هوية الجمعية]',
    key_visuals: ['[شعار الجمعية المعتمد]', '[صورة أو رسم مصرح باستخدامه ويرتبط بالمشروع]'],
    copy_on_design: `${ctx.name}\n[وصف موثق للمشروع]\n[دعوة للمساهمة ورابط معتمد]`,
    deliverables: moving ? ['نسخة فيديو بمقاس [المقاس المعتمد للقناة] ومدة [المدة المعتمدة]', 'نسخة مترجمة نصياً دون الحاجة إلى الصوت', 'ملفات المصدر والأصول المرخصة'] : ['تصميم نهائي بمقاس [المقاس المعتمد للقناة]', 'نسخة قابلة للتحرير مع الأصول المرخصة', 'نص بديل وصفي للصورة'],
    dont_do: ['لا تستخدم صور مستفيدين دون إذن موثق.', 'لا تضف أرقام أثر أو ضمانات غير موثقة.', 'لا تصنع قصة أو شهادة مستفيد.', 'لا تفترض ألواناً أو تراخيص أو مقاسات لم تعتمدها الجمعية.'],
    references_keywords: ['وضوح', 'هوية الجمعية', 'محتوى موثق'],
    ...(moving ? { scenes: [{ time: '[الافتتاحية: وقت يحدده الفريق]', action: `عرض اسم ${ctx.name}`, voiceover: 'تعرّف على [المشروع].' }, { time: '[العرض: وقت يحدده الفريق]', action: '[لقطات مصرح بها لنشاط موثق]', voiceover: '[وصف موثق للنشاط]' }, { time: '[الخاتمة: وقت يحدده الفريق]', action: 'عرض الرابط المعتمد ودعوة المساهمة', voiceover: 'للتفاصيل ووسائل المساهمة، زر [الرابط المعتمد].' }] } : {}),
  };
  return { ...meta([proof('marketing_campaigns', 'design-brief-template-v1', data, ctx.campaign ? [ctx.campaign] : [], { brief_type: type }, 'template')], ['مسودة موجزة؛ المدة والمقاسات والهوية والتراخيص تحتاج اعتماد الفريق. لا يُنتج هذا المسار صوراً أو فيديو.'], issues), brief, placeholders: placeholdersIn(brief), requires_approval: true, status: issues.some(i => i.code === 'unsupported_brief_type') ? 'needs_review' : 'draft' };
}
const GOALS: Record<string, { title: string; goal: string; message: string }> = {
  donations: { title: 'التعريف بفرصة مساهمة', goal: 'عرض مشروع موثق ووسائل المساهمة فيه.', message: 'تعرّف على [المشروع] ووسائل المساهمة عبر [الرابط المعتمد].' },
  awareness: { title: 'نافذة على عمل الجمعية', goal: 'إتاحة وصف واضح للبرامج والمشاريع المعتمدة.', message: 'اكتشف برامج [اسم الجمعية] من مصادرها المعتمدة.' },
  reactivate: { title: 'تحديث اختياري للمتبرعين', goal: 'عرض مستجد موثق لمن وافق على التواصل بعد مراجعة سجل النشاط.', message: 'اطّلع على آخر تحديث موثق عن [المشروع]: [الرابط المعتمد].' },
  acquire: { title: 'دليل المساهمة الأول', goal: 'توضيح كيفية الاطلاع على المشاريع والمساهمة ومتابعة الإيصال.', message: 'تعرّف على خطوات المساهمة في [المشروع] عبر [الرابط المعتمد].' },
  seasonal: { title: 'قالب محتوى لموسم معتمد', goal: 'ربط مشروع موثق بمناسبة يحددها الفريق ويؤكد موعدها.', message: 'بمناسبة [الموسم المعتمد]، تعرّف على [المشروع] عبر [الرابط المعتمد].' },
};
export function suggestCampaigns(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), issues: Issue[] = [];
  const projectDataset = data.projectDataset || 'projects_catalog';
  const projects = scopedRows(data.projects, projectDataset, data, issues).filter(r => r.is_active !== false && !['cancelled', 'archived', 'completed', 'inactive'].includes(str(r.status)));
  const requested = str(payload.goal_key);
  const keys = requested ? own(GOALS, requested) ? [requested] : [] : ['awareness', 'donations', 'acquire'];
  if (requested && !keys.length) issues.push({ code: 'unsupported_campaign_goal', dataset: 'request', field: 'goal_key' });
  const wizard = rec(payload.wizard_answers);
  const proposedPlatforms = (Array.isArray(wizard.platforms) ? wizard.platforms : []).map(str).filter(p => (CHANNELS as readonly string[]).includes(p));
  const campaigns = keys.map(key => {
    const definition = GOALS[key], project = projects[0];
    const projectName = str(project?.name) || '[اسم المشروع بعد اختياره]';
    return {
      name: definition.title, goal: definition.goal, audience_segment: '[الشريحة بعد التحقق من الأهلية وموافقة التواصل]',
      ...(project ? { related_project: projectName } : {}), primary_message: definition.message.replace('[المشروع]', projectName),
      content_angles: ['تعريف بالمشروع من وصف معتمد', 'شرح آلية المساهمة من مصدر موثق', 'إجابة عن سؤال متكرر موثق'],
      platforms: [...new Set(proposedPlatforms)].sort(), expected_kpis: {},
      drafts: { whatsapp: definition.message.replace('[المشروع]', projectName), sms: 'تعرّف على [المشروع] ووسائل المساهمة: [الرابط المعتمد]', x_post: definition.message.replace('[المشروع]', projectName), instagram_caption: definition.message.replace('[المشروع]', projectName), video_script: '[تعريف بالمشروع] ثم [نشاط موثق] ثم [رابط معتمد للمساهمة]' },
      design_brief: 'استخدم الهوية المعتمدة وصوراً مرخصة ونصاً موثقاً، وحدد المقاس قبل التنفيذ.',
      rationale: `${project ? `يوجد مشروع مسجل باسم ${projectName}. ` : 'لا توجد بيانات مشروع مؤهلة للاختيار. '}هذا قالب لهدف ${key}، وليس توقعاً للعائد أو إثباتاً لوجود جمهور مناسب.`,
      required_decisions: ['اختيار المشروع النهائي', 'اعتماد الجمهور والقناة وموافقة التواصل', 'تحديد الميزانية والمدة وأهداف القياس من خط أساس موثق'],
      rule_id: `campaign-template-${key}-v1`, evidence: proof(projectDataset, `campaign-template-${key}-v1`, data, project ? [project] : [], { goal_key: key }, project ? 'verified_records' : 'template'),
    };
  });
  return { ...meta(campaigns.map(c => c.evidence), ['لا تُخترع ميزانية أو مدة أو أعداد متبرعين أو مستهدفات. لا يُحدد موسم قادم دون تقويم معتمد.', 'أسماء المشاريع فقط تستخدم من السجلات؛ لا تستخرج حقائق من تحليلات أو تقييمات مولدة سابقاً.'], issues), campaigns, mode: projects.length ? 'data_driven' : 'cold_start', sources_used: { website: false, store: false, donor_data: false, projects: projects.length > 0, previous_campaigns: false, employee_answers: proposedPlatforms.length > 0 }, requires_approval: true };
}

const REPORTS: Record<string, { label: string; countKeys: string[]; title: string; segment: string; message: string; rationale: string }> = {
  donor_tiers: { label: 'المتبرعون حسب الفئة', countKeys: ['إجمالي المتبرعين', 'donors_count', 'count'], title: 'راجع تحديثات الأثر المناسبة لكل فئة', segment: '[الفئة بعد مراجعة السجل وموافقة التواصل]', message: 'مرحباً [الاسم]، إليك تحديثاً موثقاً عن [المشروع]: [الرابط المعتمد].', rationale: 'وجود صفوف في التقرير يتيح مراجعة الشرائح، ولا يكفي وحده لتحديد الاستحقاق أو اختيار الأشخاص.' },
  campaigns: { label: 'الحملات', countKeys: ['إجمالي الحملات', 'campaigns_count', 'count'], title: 'جهز ملخص نتائج الحملات', segment: '[جهة الاستلام المعتمدة بعد المراجعة]', message: 'نرفق ملخص [الحملة] للفترة [الفترة]، متضمناً النتائج الموثقة وحدود القياس: [الرابط].', rationale: 'راجع النتائج قبل اعتماد التقرير؛ عدد الحملات لا يساوي عدد المستلمين.' },
  failed_donations: { label: 'التبرعات الفاشلة', countKeys: ['إجمالي الفاشلة', 'failed_count', 'count'], title: 'راجع أسباب الفشل قبل المتابعة', segment: '[أصحاب المحاولات المؤهلة للتواصل بعد التحقق]', message: 'مرحباً [الاسم]، إذا رغبت بالمساعدة في إتمام مساهمتك، يمكنك استخدام [قناة الدعم المعتمدة]. تجاهل الرسالة إذا أتممت العملية.', rationale: 'يجب استبعاد المحاولات التي نجحت لاحقاً وتجنب طلب معلومات الدفع أو افتراض سبب الفشل.' },
  abandoned_carts: { label: 'السلال المتروكة', countKeys: ['إجمالي السلال', 'abandoned_count', 'count'], title: 'راجع السلال غير المستردة', segment: '[الأشخاص المؤهلون بعد إزالة التكرار والمسترد ومراجعة الموافقة]', message: 'مرحباً [الاسم]، يمكنك العودة إلى [رابط المشروع المعتمد] إذا رغبت بمتابعة مساهمتك. للمساعدة: [قناة الدعم].', rationale: 'لا تعدّ السلة شخصاً مستقلاً، ولا تتواصل إذا تم الاسترداد أو غابت الموافقة.' },
  subscriptions: { label: 'الاستقطاعات', countKeys: ['إجمالي المستقطعين', 'subscriptions_count', 'count'], title: 'راجع حالات الاستقطاع', segment: '[المشتركون المؤهلون للتحديث بعد المراجعة]', message: 'مرحباً [الاسم]، يمكنك مراجعة إعدادات مساهمتك الدورية من [الرابط المعتمد]، أو طلب المساعدة عبر [قناة الدعم].', rationale: 'افصل النشط عن المتوقف والملغى؛ لا تفترض سبب الإلغاء ولا تعدّل الاشتراك تلقائياً.' },
  recurring_donors: { label: 'المتبرعون المتكررون', countKeys: ['إجمالي المتكررين', 'recurring_count', 'count'], title: 'جهز تحديثاً موثقاً للمساهمين المتكررين', segment: '[المتبرعون الذين وافقوا على تلقي التحديثات]', message: 'شكراً لمساهمتك. يمكن الاطلاع على تحديث [المشروع] الموثق عبر [الرابط المعتمد].', rationale: 'التكرار المسجل يسمح بمراجعة هذه الشريحة دون استنتاج نية التبرع مجدداً.' },
  gifts: { label: 'الإهداءات', countKeys: ['إجمالي الإهداءات', 'gifts_count', 'count'], title: 'راجع حالات تسليم الإهداءات', segment: '[المرسلون المؤهلون للاستعلام بعد مراجعة التسليم]', message: 'مرحباً [الاسم]، للاستفسار عن حالة إهدائك استخدم [قناة الدعم المعتمدة].', rationale: 'راجع حالة التسليم وتجنب مشاركة بيانات متلقي الإهداء أو افتراض عدم وصوله.' },
  project_donors: { label: 'متبرعو المشاريع', countKeys: ['إجمالي التبرعات للمشاريع', 'إجمالي التبرعات', 'إجمالي العمليات', 'donations_count', 'count'], title: 'جهز تحديثاً لكل مشروع', segment: '[متبرعو المشروع بعد إزالة التكرار ومراجعة الموافقة]', message: 'إليك تحديثاً موثقاً عن [المشروع]: [الرابط المعتمد]. شكراً لمساهمتك.', rationale: 'عدد التبرعات ليس عدد المتبرعين؛ يجب ربط السجلات بالمشروع دون تخمين المستلمين.' },
};
export function suggestReportActions(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), report = REPORTS[str(payload.report_type)], aggregate = rec(payload.aggregates), issues: Issue[] = [];
  const countEntries = report ? report.countKeys.filter(k => own(aggregate, k)).map(k => ({ key: k, value: parseNonNegativeInteger(aggregate[k]) })) : [];
  const count = countEntries.length && countEntries.every(e => e.value !== null) && new Set(countEntries.map(e => e.value)).size === 1 ? countEntries[0].value : null;
  if (!report) issues.push({ code: 'unsupported_report_type', dataset: 'request', field: 'report_type' });
  if (count === null) issues.push({ code: countEntries.length > 1 ? 'conflicting_report_counts' : 'report_count_missing_or_invalid', dataset: 'request.aggregates' });
  const actions = report && count !== null && count > 0 ? [{ title: report.title, target_segment: report.segment, channel: 'email', priority: 'medium', due_in_days: 7, suggested_message: report.message, rationale: report.rationale, proposal_only: true, recipients: [], requires_recipient_review: true, schedule_is_suggestion: true }] : [];
  const evidence = proof('request.aggregates', 'report-action-catalog-v1', data, [], { report_type: str(payload.report_type), row_count: count, count_keys: countEntries.map(e => e.key) }, 'supplied_input');
  return { ...meta([evidence], ['المؤشرات المرسلة لم تُعد قراءتها من قاعدة البيانات. العينات لا تستخدم لتقدير حجم الجمهور أو تحديد المستلمين.', 'القناة والموعد اقتراحان يحتاجان اعتماداً. لا يُرسل المحتوى ولا يُنشأ تكليف.'], issues), summary: report ? `${report.label}: ${count === null ? 'عدد الصفوف غير متاح أو غير متسق' : `${count} صفاً بحسب المؤشرات المرسلة`}. الاقتراحات خطوات مراجعة، ولا تثبت سبب أي تغير.` : 'نوع التقرير غير مدعوم في الكتالوج الحالي.', key_insights: count === null ? [] : [`عدد الصفوف المرسل: ${count}.`, 'عدد المستلمين المؤهلين غير محدد في هذه البيانات.'], actions, status: count !== null ? 'preview' : 'insufficient_data' };
}

const COUNT_METRICS = ['donations_count', 'donors', 'donors_total', 'recurring_donors', 'abandoned_carts', 'recovered_carts', 'employees_count', 'tasks_total', 'tasks_completed', 'campaigns', 'failed_donations', 'gifts_count', 'projects_count'] as const;
const SCORE_METRICS = ['fundraising_score', 'donor_engagement_score', 'service_score', 'team_score', 'overall_score', 'store_health_score'] as const;
type MetricContext = { values: Record<string, number | null>; currency: string | null; evidence: Proof; issues: Issue[]; origin: 'verified_records' | 'supplied_input'; periodLabel: string };
function metricContext(payload: BusinessRow, data: BusinessVerifiedData): MetricContext {
  const issues: Issue[] = [], values: Record<string, number | null> = {};
  const origin = data.metrics || data.summary ? 'verified_records' : 'supplied_input';
  let metrics = data.metrics ? rec(data.metrics) : rec(payload.metrics);
  if (!data.metrics && data.summary) {
    const summary = rec(data.summary), totals = rec(summary.totals);
    metrics = { org_id: summary.organization_id, donations_count: totals.donations, total_donated: totals.donations_amount, donors: totals.observed_donors, donors_total: totals.donors, campaigns: totals.active_campaigns, currency: summary.currency };
  }
  const namedOrg = str(metrics.org_id || metrics.organization_id);
  if (namedOrg && orgId(data) && namedOrg !== orgId(data)) { issues.push({ code: 'organization_scope_mismatch', dataset: 'metrics' }); metrics = {}; }
  if (metrics.ai_generated === true || metrics.source === 'ai' || metrics.source === 'historical_ai') { issues.push({ code: 'historical_ai_excluded', dataset: 'metrics' }); metrics = {}; }
  for (const key of COUNT_METRICS) {
    values[key] = parseNonNegativeInteger(metrics[key]);
    if (own(metrics, key) && values[key] === null) issues.push({ code: 'invalid_count', dataset: 'metrics', field: key });
  }
  for (const key of SCORE_METRICS) {
    const parsed = number(metrics[key]);
    values[key] = parsed !== null && parsed <= 100 ? parsed : null;
    if (own(metrics, key) && values[key] === null) issues.push({ code: 'invalid_recorded_score', dataset: 'metrics', field: key });
  }
  const code = currency(metrics.currency) || (metrics.currency == null ? currency(data.currency) : null);
  for (const key of ['total_donated', 'gifts_amount']) {
    const cents = parseMoneyToCents(metrics[key]);
    values[`${key}_cents`] = code && cents !== null ? cents : null;
    values[key] = code && cents !== null ? cents / 100 : null;
    if (own(metrics, key) && cents === null) issues.push({ code: 'invalid_amount', dataset: 'metrics', field: key });
    if (own(metrics, key) && !code) issues.push({ code: 'currency_missing_or_invalid', dataset: 'metrics', field: key });
  }
  const fraction = (part: string, total: string, output: string) => {
    const p = values[part], t = values[total];
    values[output] = p !== null && t !== null && p <= t ? percentage(p, t) : null;
    if (p !== null && t !== null && p > t) issues.push({ code: 'count_exceeds_total', dataset: 'metrics', field: `${part}/${total}` });
  };
  fraction('recovered_carts', 'abandoned_carts', 'recovery_rate');
  fraction('tasks_completed', 'tasks_total', 'task_completion_rate');
  fraction('recurring_donors', 'donors', 'recurring_share');
  fraction('donors', 'donors_total', 'active_donor_share');
  values.avg_donation = values.total_donated_cents !== null && values.donations_count !== null && values.donations_count > 0 ? rounded(values.total_donated_cents / 100 / values.donations_count) : null;
  values.remaining_tasks = values.tasks_total !== null && values.tasks_completed !== null && values.tasks_completed <= values.tasks_total ? values.tasks_total - values.tasks_completed : null;
  values.unrecovered_carts = values.abandoned_carts !== null && values.recovered_carts !== null && values.recovered_carts <= values.abandoned_carts ? values.abandoned_carts - values.recovered_carts : null;
  const evidence = proof(origin === 'verified_records' ? 'verified.metrics' : 'request.metrics', 'executive-metric-validation-v1', data, [], { ...values, currency: code }, origin);
  const source = data.summary ? rec(data.summary) : rec(data.metrics);
  const original = rec(source.evidence);
  const period = rec(source.period || original.period);
  const from = calendarDate(period.from), to = calendarDate(period.to);
  const scopedSource = !str(source.organization_id || source.org_id) || str(source.organization_id || source.org_id) === orgId(data);
  const periodIsValid = origin === 'verified_records' && scopedSource && from !== null && to !== null && from <= to;
  evidence.period = periodIsValid ? { from, to, ...(number(period.utc_offset_minutes) !== null ? { utc_offset_minutes: number(period.utc_offset_minutes) } : {}) } : null;
  if (origin === 'verified_records' && original.source === BUSINESS_RULE_SOURCE && original.organization_id === orgId(data) && scopedSource) {
    const ids = Array.isArray(original.row_ids) ? original.row_ids.map(str).filter(Boolean).sort() : [];
    const count = parseNonNegativeInteger(original.row_count);
    if (count !== null && count >= ids.length) {
      evidence.row_ids = ids.slice(0, 200);
      evidence.row_count = count;
      evidence.row_ids_truncated = original.row_ids_truncated === true || count > ids.length || ids.length > 200;
      evidence.source_evidence = [{ source: original.source, dataset: str(original.dataset), organization_id: original.organization_id, row_ids: evidence.row_ids, row_count: count, row_ids_truncated: evidence.row_ids_truncated, period: evidence.period, metrics: rec(original.metrics) }];
    } else issues.push({ code: 'invalid_aggregate_provenance', dataset: 'verified.metrics' });
  }
  const periodLabel = periodIsValid ? `${from} إلى ${to}` : origin === 'verified_records' ? 'كل السجلات المتاحة' : 'فترة المؤشرات المرسلة غير متحقق منها';
  return { values, currency: code, evidence, issues, origin, periodLabel };
}
function internalRecommendations(context: MetricContext) {
  const m = context.values;
  const recommendations: { title: string; impact: 'high' | 'medium' | 'low'; action: string }[] = [];
  if (context.issues.length) recommendations.push({ title: 'استكمال جودة المؤشرات', impact: 'high', action: 'راجع القيم غير الصالحة والعملة واتساق العدادات قبل اعتماد النتائج.' });
  if (m.failed_donations !== null && m.failed_donations > 0) recommendations.push({ title: 'مراجعة محاولات الدفع الفاشلة', impact: 'high', action: `افحص أسباب ${m.failed_donations} محاولة مسجلة واستبعد ما نجح لاحقاً. لا تُنسب المشكلة للجمعية أو المتبرع دون دليل.` });
  if (m.unrecovered_carts !== null && m.unrecovered_carts > 0) recommendations.push({ title: 'مراجعة السلال غير المستردة', impact: 'medium', action: `راجع ${m.unrecovered_carts} سلة غير مستردة، ثم أزل التكرار وتحقق من موافقة التواصل قبل إعداد متابعة.` });
  if (m.remaining_tasks !== null && m.remaining_tasks > 0) recommendations.push({ title: 'مراجعة المهام غير المكتملة', impact: 'medium', action: `راجع حالة ومواعيد ${m.remaining_tasks} مهمة غير مكتملة. عدم الاكتمال لا يعني التأخر دون تاريخ استحقاق.` });
  if (m.donations_count !== null && m.donations_count > 0) recommendations.push({ title: 'تحقق من قابلية تتبع التبرعات', impact: 'medium', action: `اربط ملخص ${m.donations_count} تبرعاً بالفترة والمصدر وحالة العملية قبل مشاركته.` });
  return recommendations;
}
export function generateExecutiveReport(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), context = metricContext(payload, data), m = context.values;
  const row = (metric: string, key: string, unit = '', guidance = 'قيمة وصفية من المصدر المحدد؛ لا تفسر سبب التغير أو جودة الأداء وحدها.') => ({ metric, result: m[key] === null ? 'غير متاح' : `${m[key]}${unit}`, analysis: m[key] === null ? 'يلزم استكمال بيانات هذا المؤشر؛ لا تُعامل القيمة المفقودة كصفر.' : guidance });
  const moneyUnit = context.currency ? ` ${context.currency}` : '';
  const sections = [
    { title: 'أداء جمع التبرعات', rows: [row('التبرعات المسجلة', 'total_donated', moneyUnit), row('عدد التبرعات', 'donations_count'), row('متوسط التبرع المحسوب', 'avg_donation', moneyUnit, 'إجمالي التبرعات ÷ عدد العمليات. لا يمثل توقعاً لقيمة تبرع مستقبلي.')] },
    { title: 'قاعدة المتبرعين', rows: [row('المتبرعون بحسب تعريف المصدر', 'donors'), row('المتبرعون في القاعدة', 'donors_total'), row('المتبرعون المتكررون', 'recurring_donors'), row('نسبة المتكررين إلى النشطين', 'recurring_share', '%')] },
    { title: 'كفاءة العمليات وخدمة المتبرع', rows: [row('السلال المتروكة', 'abandoned_carts'), row('السلال المستردة', 'recovered_carts'), row('نسبة الاسترداد المحسوبة', 'recovery_rate', '%'), row('محاولات التبرع الفاشلة', 'failed_donations')] },
    { title: 'الأداء التشغيلي والفريق', rows: [row('الموظفون', 'employees_count'), row('المهام', 'tasks_total'), row('المهام المكتملة', 'tasks_completed'), row('نسبة إنجاز المهام المحسوبة', 'task_completion_rate', '%'), row('الحملات', 'campaigns')] },
    { title: 'التقييم العام', rows: [row('درجة جمع التبرعات المرسلة', 'fundraising_score', '/100', 'عرض للدرجة المرسلة فقط؛ لم تُعتمد أو تتغير سياسة احتسابها.'), row('درجة التفاعل المرسلة', 'donor_engagement_score', '/100', 'لا تستخدم هذه الدرجة وحدها للحكم على الجمعية أو العاملين.'), row('الدرجة الإجمالية المرسلة', 'overall_score', '/100', 'لم يُنتج تصنيف نوعي أو تعديل للدرجة دون سياسة معتمدة.')] },
  ];
  const report = {
    executive_summary: `ملخص وصفي للفترة: ${context.periodLabel}. عدد التبرعات: ${fmt(m.donations_count)}، والمهام المكتملة: ${fmt(m.tasks_completed)} من ${fmt(m.tasks_total)}. ${context.origin === 'supplied_input' ? 'يعتمد على مؤشرات مرسلة لم تُعد قراءتها من قاعدة البيانات.' : 'يعتمد على بيانات وفرها القارئ المصرح له.'} لا تتوافر مقارنة زمنية أو سياسة معتمدة لإصدار حكم نوعي.`,
    overall_verdict: 'يحتاج مراجعة بشرية', verdict_status: 'needs_review', sections,
    strategic_recommendations: internalRecommendations(context).map(r => `${r.title}: ${r.action}`),
  };
  return { ...meta([context.evidence], ['لا يحدد التقرير أسباب النتائج أو يصدر حكماً على الموظفين.', 'الدرجات المرسلة معروضة كما هي ولا تستبدل سياسة تقييم معتمدة.', 'لا تستخدم التحويلات البنكية غير المطابقة كضعف أو توصية أو مؤشر أداء سلبي.'], context.issues), report };
}
export function generateAdminInsights(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), context = metricContext(payload, data), m = context.values;
  const strengths: string[] = [], weaknesses: string[] = [], opportunities: string[] = [];
  if (m.tasks_completed !== null && m.tasks_completed > 0) strengths.push(`يوجد ${m.tasks_completed} مهمة مكتملة بحسب المؤشر المرسل؛ لا يثبت العدد وحده جودة الإنجاز.`);
  if (m.recovered_carts !== null && m.recovered_carts > 0) strengths.push(`توجد ${m.recovered_carts} سلة مستردة مسجلة؛ لم تُنسب النتيجة لقناة أو موظف.`);
  if (m.recurring_donors !== null && m.recurring_donors > 0) strengths.push(`يظهر المؤشر ${m.recurring_donors} متبرعاً متكرراً بحسب تعريف المصدر.`);
  if (m.remaining_tasks !== null && m.remaining_tasks > 0) weaknesses.push(`توجد ${m.remaining_tasks} مهمة غير مكتملة. لا توجد بيانات استحقاق تسمح بوصفها متأخرة.`);
  if (m.unrecovered_carts !== null && m.unrecovered_carts > 0) weaknesses.push(`توجد ${m.unrecovered_carts} سلة لم تُسجل كمستردة. السبب وحجم الجمهور الفريد غير محددين.`);
  if (m.failed_donations !== null && m.failed_donations > 0) weaknesses.push(`سُجلت ${m.failed_donations} محاولة تبرع فاشلة. يلزم التحقق من الحالة اللاحقة قبل الاستنتاج.`);
  if (context.issues.length) weaknesses.push('توجد قيم غير صالحة أو بيانات عملة أو نطاق تحتاج مراجعة قبل اعتماد الأرقام.');
  if (m.donations_count !== null && m.donations_count > 0) opportunities.push(`إعداد سجل قابل للتتبع لـ${m.donations_count} تبرعاً قبل مشاركة ملخص الأثر.`);
  if (m.campaigns !== null && m.campaigns > 0) opportunities.push(`توحيد تعريفات قياس ${m.campaigns} حملة قبل مقارنة القنوات أو حساب العائد.`);
  const insight = { summary: `قراءة وصفية للمؤشرات المتاحة: التبرعات ${fmt(m.donations_count)}، والمتبرعون بحسب المؤشر ${fmt(m.donors)}، والمهام ${fmt(m.tasks_total)}. لا توجد مقارنة موثقة بجمعيات مماثلة أو بالفترة السابقة.`, strengths, weaknesses, opportunities, recommendations: internalRecommendations(context) };
  return { ...meta([context.evidence], ['لا تستخدم المقارنة بين الجمعيات دون نطاق وصول وأسس مقارنة متكافئة؛ بيانات all المرسلة لا تعتمد هنا.', 'لم تُقرأ ذاكرة تحليل سابقة ولم يُحفظ تحليل جديد.', 'لا تعتبر التحويلات البنكية غير المطابقة نقطة ضعف أو توصية.'], context.issues), insight, cache_id: null, cached: false };
}
export function suggestInnovations(payloadValue: unknown, data: BusinessVerifiedData = {}) {
  const payload = rec(payloadValue), context = metricContext(payload, data), m = context.values;
  const suggestions: BusinessRow[] = [];
  const add = (id: string, field: string, title: string, category: string, area: string, summary: string, effort: string) => {
    if (m[field] === null || m[field] === 0) return;
    suggestions.push({ title, summary, category, area, priority: 'medium', impact: 'فرضية تحسين تحتاج اختباراً ومقياس نجاح معتمداً؛ لا يوجد وعد بنتيجة أو مقدار زيادة.', effort, data_basis: `${field}: ${m[field]} بحسب المصدر المحدد.`, rule_id: id, evidence: proof(context.evidence.dataset, id, data, [], { [field]: m[field] }, context.origin) });
  };
  add('innovation-payment-reason-register', 'failed_donations', 'سجل أسباب فشل قابل للمراجعة', 'ux', 'تجربة التبرع', 'اربط محاولات الدفع الفاشلة بسبب موثق وحالتها اللاحقة، ثم اختبر رحلة واحدة بعد مراجعة الخصوصية. لا تستنتج السبب من العدد.', 'medium');
  add('innovation-recovery-review', 'unrecovered_carts', 'مراجعة استرداد بلا تكرار', 'analytics', 'السلال المتروكة', 'اعرض السلال التي لم تسترد بعد إزالة التكرار، مع حالة موافقة التواصل. اختبر خطوة دعم معتمدة بدل إرسال جماعي تلقائي.', 'medium');
  add('innovation-task-checklist', 'remaining_tasks', 'قائمة إكمال مرتبطة بالمهمة', 'automation', 'المهام', 'أضف قائمة تحقق قابلة للمراجعة لكل نوع مهمة. اختبرها على مهمة يختارها المسؤول، من دون تعديل الدرجات أو توزيع العمل تلقائياً.', 'low');
  add('innovation-project-source-links', 'projects_count', 'بطاقة مشروع موثقة المصدر', 'content', 'صفحة المشروع', 'اربط وصف المشروع وملخص استخدام التبرعات بمصدر وتاريخ مراجعة، واعرض فقط الحقائق التي اعتمدها الفريق.', 'medium');
  add('innovation-gift-status', 'gifts_count', 'عرض واضح لحالة الإهداء', 'feature', 'الإهداءات', 'جهز تصوراً يعرض حالة تسليم الإهداء دون كشف بيانات المستلم، مع قناة استعلام معتمدة ورسائل لا تفترض حدوث التسليم.', 'medium');
  add('innovation-campaign-measurement', 'campaigns', 'بطاقة تعريف موحدة للمقياس', 'data', 'الحملات', 'عرّف العملة وفترة القراءة وما إذا كانت القيم تراكمية أو إضافية لكل حملة قبل جمعها أو المقارنة بينها.', 'low');
  return { ...meta([context.evidence], ['اختيار من كتالوج أفكار محدد بقواعد؛ لا يدعي الجدة المطلقة أو يتنبأ بنتائج.', 'لا تُنشأ ميزات أو مهام أو رسائل تلقائياً؛ كل فكرة تحتاج مراجعة وتنفيذاً منفصلاً.'], context.issues), suggestions, model: null, status: suggestions.length ? 'preview' : 'insufficient_data' };
}

/** Route-compatible envelopes; every path remains a side-effect-free proposal. */
export function generateBusinessPreview(route: string, payload: BusinessRow = {}, verifiedData: BusinessVerifiedData = {}): BusinessRow {
  switch (route) {
    case 'classify-expense-batch': return classifyExpenses(payload, verifiedData);
    case 'suggest-finance-reports': return suggestFinanceReports(verifiedData);
    case 'report-suggestions': return suggestReportActions(payload, verifiedData);
    case 'marketing-evaluate-campaign': return evaluateCampaign(payload, verifiedData);
    case 'marketing-design-brief': return generateDesignBrief(payload, verifiedData);
    case 'marketing-generate-content': return generateMarketingContent(payload, verifiedData);
    case 'marketing-suggest-campaigns': return suggestCampaigns(payload, verifiedData);
    case 'innovation-suggestions': return suggestInnovations(payload, verifiedData);
    case 'executive-report': return generateExecutiveReport(payload, verifiedData);
    case 'admin-insights': return generateAdminInsights(payload, verifiedData);
    default: return { ...meta([], ['لا يتضمن هذا الكتالوج المسار المطلوب.']), error: 'unsupported_business_route', status: 'needs_review' };
  }
}
