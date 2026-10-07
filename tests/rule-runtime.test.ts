import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { EXTERNAL_PROVIDER_ROUTES } from '../supabase/functions/_shared/automation-policy.ts';
import { handleRulesRequest, withRulesMode } from '../supabase/functions/_shared/rule-mode.ts';
import { calendarDate } from '../supabase/functions/_shared/rule-analysis.ts';
import { deterministicPreviewId } from '../supabase/functions/_shared/rule-plans.ts';
import { BUSINESS_ROUTES } from '../supabase/functions/_shared/rule-business.ts';

// All hosts, identities and database responses below are fixtures. No live I/O.
const ORIGIN = 'https://platform.invalid';
const USER = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const OTHER_ORG = '33333333-3333-4333-8333-333333333333';
const OTHER_USER = '44444444-4444-4444-8444-444444444444';
const UPLOAD = '55555555-5555-4555-8555-555555555555';
const PLAN = '66666666-6666-4666-8666-666666666666';
const CAMPAIGN = '77777777-7777-4777-8777-777777777777';
const TOKEN = 'Bearer fixture-user-token';
type Row = Record<string, unknown>;
type Call = { url: URL; method: string; headers: Headers };
const environment = (mode?: string) => (name: string): string | undefined => ({
  SUPABASE_URL: ORIGIN, SUPABASE_ANON_KEY: 'fixture-anon-key', KFAAH_AUTOMATION_MODE: mode,
})[name];
const today = () => calendarDate(new Date())!;
const offsetDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function fields(select: string): string[] {
  const result: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < select.length; i++) {
    if (select[i] === '(') depth++;
    if (select[i] === ')') depth--;
    if (select[i] === ',' && depth === 0) { result.push(select.slice(start, i)); start = i + 1; }
  }
  result.push(select.slice(start));
  return result;
}
function project(row: Row, select: string): Row {
  return Object.fromEntries(fields(select).map(field => {
    const key = field.split(/[(:]/)[0];
    return [key, structuredClone(row[key] ?? null)];
  }));
}
function fixture(options: {
  authenticated?: boolean; memberships?: Row[]; roles?: Row[]; tables?: Record<string, Row[]>;
  storage?: () => Response; expectedOrganization?: string;
} = {}) {
  const calls: Call[] = [];
  const tables: Record<string, Row[]> = {
    donations: [{ id: 'donation-1', organization_id: ORG, donor_id: 'donor-1', amount: 125.34, currency: 'SAR', status: 'paid', donation_date: today(), project_name: 'Verified project' }],
    data_uploads_log: [{ id: UPLOAD, organization_id: ORG, file_name: 'fixture.txt', file_path: `${ORG}/fixture.txt`, storage_bucket: 'org-documents', detected_schema: 'other', ai_analysis: { legacy: true } }],
    marketing_campaigns: [{ id: CAMPAIGN, organization_id: ORG, name: 'Verified campaign', related_project: 'Verified project', status: 'draft', ai_generated: false }],
    employees: [{ id: USER, organization_id: ORG }],
    ...options.tables,
  };
  const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init?.headers);
    calls.push({ url, method, headers });
    assert.equal(url.origin, ORIGIN, `external egress: ${url}`);
    assert.equal(method, 'GET', `unexpected write: ${method} ${url}`);
    assert.equal(headers.get('authorization'), TOKEN);
    assert.equal(headers.get('apikey'), 'fixture-anon-key');
    assert.equal(init?.redirect, 'error');
    if (url.pathname === '/auth/v1/user') return Response.json(options.authenticated === false ? { error: 'invalid token' } : { id: USER }, { status: options.authenticated === false ? 401 : 200 });
    assert.equal(calls[0].url.pathname, '/auth/v1/user');
    if (url.pathname === '/rest/v1/user_organizations') {
      assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
      assert.equal(url.searchParams.get('approval_status'), 'eq.approved');
      return Response.json(options.memberships ?? [{ organization_id: ORG, approval_status: 'approved' }]);
    }
    if (url.pathname === '/rest/v1/user_roles') {
      assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
      assert.ok(url.searchParams.get('select')?.includes('organization_id'));
      return Response.json(options.roles ?? [{ role: 'admin', organization_id: ORG }]);
    }
    assert.deepEqual(calls.slice(0, 3).map(call => call.url.pathname), ['/auth/v1/user', '/rest/v1/user_organizations', '/rest/v1/user_roles']);
    if (url.pathname.startsWith('/storage/v1/object/authenticated/')) return options.storage?.() ?? new Response('Verified local source text.');
    assert.ok(url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/rest/v1/rpc/'), `unsupported platform call: ${url}`);
    assert.equal(url.searchParams.get('organization_id'), `eq.${options.expectedOrganization ?? ORG}`);
    assert.equal(headers.get('prefer'), 'count=exact');
    const table = url.pathname.slice('/rest/v1/'.length);
    let rows = tables[table] ?? [];
    for (const [key, value] of url.searchParams) if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
    const total = rows.length;
    const offset = Number(url.searchParams.get('offset') ?? 0);
    rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? 1000));
    const select = url.searchParams.get('select')!;
    return new Response(JSON.stringify(rows.map(row => project(row, select))), { headers: { 'content-range': rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}` } });
  }) as typeof fetch;
  return { calls, transport, tables, dataCalls: () => calls.filter(call => !['/auth/v1/user', '/rest/v1/user_organizations', '/rest/v1/user_roles'].includes(call.url.pathname)) };
}
function request(body: Row = {}, authorization: string | null = TOKEN) {
  return new Request(`${ORIGIN}/functions/v1/fixture`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, body: JSON.stringify({ organization_id: ORG, ...body }) });
}
async function streamMessage(response: Response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const text = await response.text();
  assert.match(text, /data: \[DONE\]/);
  return JSON.parse(text.split('\n').find(line => line.startsWith('data: {'))!.slice(6));
}
function forbidBackground(t: TestContext) {
  let attempted = 0;
  const forbidden = () => { attempted++; throw new Error('Background work is prohibited in preview mode'); };
  t.mock.method(globalThis, 'setTimeout', forbidden);
  t.mock.method(globalThis, 'setInterval', forbidden);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'EdgeRuntime');
  Object.defineProperty(globalThis, 'EdgeRuntime', { configurable: true, value: { waitUntil: forbidden } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'EdgeRuntime', descriptor); else Reflect.deleteProperty(globalThis, 'EdgeRuntime'); });
  return () => assert.equal(attempted, 0);
}

test('actual handlers for all inventoried routes and task dispatchers bypass legacy in rules/default/invalid modes', async t => {
  const assertNoBackground = forbidBackground(t);
  const data = fixture();
  t.mock.method(globalThis, 'fetch', data.transport);
  let legacyCalls = 0, clientCalls = 0, topLevelCalls = 0;
  const routes = [...EXTERNAL_PROVIDER_ROUTES, 'smart-task-dispatcher', 'top-up-employee-tasks'];
  const successful = new Set(['donor-insights', 'daily-donor-intelligence', 'run-intelligence', 'employee-assistant', 'innovation-chat', 'analyze-uploaded-file', 'generate-plan-from-excel', ...BUSINESS_ROUTES]);
  const requiresPreviewReview = new Set(['generate-executive-plans', 'generate-tasks', 'generate-plan-deep', 'generate-action-plan']);
  for (const route of routes) {
    let mode: string | undefined;
    let handler: ((request: Request) => Promise<Response> | Response) | undefined;
    const source = readFileSync(new URL(`../supabase/functions/${route}/index.ts`, import.meta.url), 'utf8');
    // Strip remote dependency imports rather than downloading or executing legacy libraries.
    // The actual entrypoint body and serve(withRulesMode(...)) expression remain intact.
    const parsed = ts.createSourceFile('entrypoint.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const withoutImports = ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed, parsed.statements.filter(statement => !ts.isImportDeclaration(statement))));
    const output = ts.transpileModule(withoutImports, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const serve = (value: typeof handler) => { assert.equal(handler, undefined); handler = value; };
    const forbidden = () => { topLevelCalls++; throw new Error('Unexpected legacy side effect'); };
    vm.runInNewContext(output, {
      exports: {}, z, console, TextEncoder, TextDecoder, Response, Request, URL, URLSearchParams, ReadableStream, AbortController, AbortSignal,
      fetch: forbidden, setTimeout: forbidden, setInterval: forbidden, EdgeRuntime: { waitUntil: forbidden },
      createClient: () => { clientCalls++; throw new Error('Legacy database client must not be constructed'); },
      serve, Deno: { serve, env: { get: (name: string) => environment(mode)(name) } },
      withRulesMode: (name: string, legacy: (req: Request) => Promise<Response>) => {
        assert.equal(name, route);
        return withRulesMode(name, req => { legacyCalls++; return legacy(req); }, name => environment(mode)(name));
      },
    }, { timeout: 1000 });
    assert.ok(handler, `no registered handler: ${route}`);
    for (mode of [undefined, 'rules', 'disabled', 'legacy_AI', 'legacy_ai ']) {
      const response = await handler(request({ message: 'help', upload_id: UPLOAD, panel: 'donations', campaign_id: CAMPAIGN, channel: 'whatsapp', plan_name: 'Runtime fixture', year: 2026, months: [10], columns: [], rows: [] }));
      const text = await response.text();
      assert.equal(response.status, successful.has(route) ? 200 : requiresPreviewReview.has(route) ? 409 : 422, `${route} mode=${String(mode)}: ${text}`);
      if (requiresPreviewReview.has(route)) {
        const result = JSON.parse(text);
        assert.equal(result.error, 'preview_requires_review');
        assert.equal(result.preview.preview_only, true);
        assert.equal(result.preview.writes_performed, 0);
        assert.equal(result.preview.notifications_sent, 0);
      }
    }
  }
  assert.equal(legacyCalls, 0);
  assert.equal(clientCalls, 0);
  assert.equal(topLevelCalls, 0);
  assert.ok(data.calls.length > 0);
  assertNoBackground();
});

test('only exact legacy_ai delegates to a legacy handler', async () => {
  let invoked = 0;
  const handler = withRulesMode('fixture', () => { invoked++; return new Response('fixture legacy'); }, environment('legacy_ai'));
  assert.equal(await (await handler(request())).text(), 'fixture legacy');
  assert.equal(invoked, 1);
});

test('authentication, approved organization, and organization-scoped manager role precede every donor data read', async () => {
  const unauthenticated = fixture();
  assert.equal((await handleRulesRequest('donor-insights', request({}, null), environment(), unauthenticated.transport)).status, 401);
  assert.equal(unauthenticated.calls.length, 0);
  const rejected = fixture({ authenticated: false });
  assert.equal((await handleRulesRequest('donor-insights', request(), environment(), rejected.transport)).status, 401);
  assert.equal(rejected.calls.length, 1);
  const foreign = fixture();
  assert.equal((await handleRulesRequest('donor-insights', request({ organization_id: OTHER_ORG }), environment(), foreign.transport)).status, 403);
  assert.equal(foreign.dataCalls().length, 0);
  const crossRole = fixture({ memberships: [{ organization_id: ORG, approval_status: 'approved' }, { organization_id: OTHER_ORG, approval_status: 'approved' }], roles: [{ role: 'viewer', organization_id: ORG }, { role: 'admin', organization_id: OTHER_ORG }] });
  assert.equal((await handleRulesRequest('donor-insights', request(), environment(), crossRole.transport)).status, 403);
  assert.equal(crossRole.dataCalls().length, 0);
  const pending = fixture({ memberships: [], roles: [{ role: 'admin', organization_id: ORG }] });
  assert.equal((await handleRulesRequest('donor-insights', request(), environment(), pending.transport)).status, 403);
  assert.equal(pending.dataCalls().length, 0);
});

test('donor runtime uses authenticated source rows instead of client totals and retains a supported panel', async () => {
  const data = fixture();
  const response = await handleRulesRequest('donor-insights', request({ panel: 'donations', user_id: OTHER_USER, context: { currency: 'SAR', total_donations_count: 999999, total_donations_amount: 8888888 }, summary: { donations_amount: 777777 } }), environment(), data.transport);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.panel, 'donations');
  assert.equal(result.organization_id, ORG);
  assert.equal(result.source, 'rules-v1');
  assert.equal(result.metrics.donations_count, 1);
  assert.equal(result.metrics.donations_total_cents, 12534);
  assert.doesNotMatch(JSON.stringify(result), /999999|8888888|777777/);
  assert.ok(result.evidence.some((proof: Row) => Array.isArray(proof.row_ids) && proof.row_ids.includes('donation-1')));
});

test('daily donor preview makes no persisted-task or notification claims', async () => {
  const data = fixture();
  const result = await (await handleRulesRequest('daily-donor-intelligence', request({ trigger: 'manual', caller_user_id: OTHER_USER }), environment(), data.transport)).json();
  assert.equal(result.success, true);
  assert.equal(result.preview_only, true);
  assert.equal(result.created_tasks, 0);
  assert.equal(result.notifications_sent, 0);
  assert.equal(result.summary.evidence.row_count, 1);
  assert.ok(data.calls.every(call => call.method === 'GET'));
});

test('every business preview requires a manager role for the selected organization', async () => {
  for (const route of BUSINESS_ROUTES) {
    const data = fixture({ roles: [{ role: 'viewer', organization_id: ORG }, { role: 'admin', organization_id: OTHER_ORG }] });
    const response = await handleRulesRequest(route, request({ campaign_id: CAMPAIGN }), environment(), data.transport);
    assert.equal(response.status, 403, route);
    assert.equal(data.dataCalls().length, 0, route);
  }
});

test('campaign previews require a stored campaign in the authorized organization and ignore client replacement records', async () => {
  for (const route of ['marketing-evaluate-campaign', 'marketing-design-brief', 'marketing-generate-content']) {
    const foreign = fixture({ tables: { marketing_campaigns: [{ id: CAMPAIGN, organization_id: OTHER_ORG, name: 'Foreign campaign' }] } });
    const forbidden = await handleRulesRequest(route, request({ campaign_id: CAMPAIGN, campaign: { id: CAMPAIGN, organization_id: ORG, name: 'Forged campaign' } }), environment(), foreign.transport);
    assert.equal(forbidden.status, 404, route);
    const data = fixture();
    const response = await handleRulesRequest(route, request({ campaign_id: CAMPAIGN, campaign: { id: CAMPAIGN, organization_id: ORG, name: 'Forged campaign' }, name: 'Forged campaign', channel: 'whatsapp' }), environment(), data.transport);
    assert.equal(response.status, 200, route);
    const result = await response.json();
    assert.equal(result.preview_only, true);
    assert.equal(result.writes_enabled, false);
    assert.equal(result.messages_sent, 0);
    assert.doesNotMatch(JSON.stringify(result), /Forged campaign|Foreign campaign/);
    assert.match(JSON.stringify(result), /Verified campaign/);
    assert.ok(data.dataCalls().filter(call => call.url.pathname === '/rest/v1/marketing_campaigns').every(call => call.url.searchParams.get('id') === `eq.${CAMPAIGN}`));
  }
});

test('campaign evaluation does not trust client currency, aggregation grain, or replacement measurements', async () => {
  const readings = [1, 2].map(index => ({ id: `measurement-${index}`, organization_id: ORG, campaign_id: CAMPAIGN, impressions: 100, clicks: 10, conversions: 2, donations_count: 2, donations_amount: 50, cost: 25, channel: 'email', measured_at: `${today()}T10:00:00Z` }));
  const data = fixture({ tables: { marketing_campaign_metrics: readings } });
  const response = await handleRulesRequest('marketing-evaluate-campaign', request({ campaign_id: CAMPAIGN, currency: 'SAR', metricMode: 'increments', metric_mode: 'increments', campaignMetrics: [{ id: 'fake', currency: 'SAR', cost: 1, donations_amount: 999999 }] }), environment(), data.transport);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.evaluation.kpi_analysis.roi_pct, null);
  assert.equal(result.totals.cost, null);
  assert.equal(result.totals.donations_amount, null);
  assert.ok(result.quality.issues.some((issue: Row) => issue.code === 'metric_grain_required'));
  assert.doesNotMatch(JSON.stringify(result), /999999/);
  const measured = data.dataCalls().find(call => call.url.pathname === '/rest/v1/marketing_campaign_metrics')!;
  assert.equal(measured.url.searchParams.get('campaign_id'), `eq.${CAMPAIGN}`);
});

test('financial and executive previews ignore forged client totals and scores', async () => {
  for (const route of ['suggest-finance-reports', 'executive-report', 'admin-insights']) {
    const data = fixture();
    const response = await handleRulesRequest(route, request({ metrics: { donations_count: 999999, total_donated: 8888888, overall_score: 77, currency: 'SAR' }, summary: { totals: { donations: 999999 } }, expenses: [{ amount: 999999, currency: 'SAR' }] }), environment(), data.transport);
    assert.equal(response.status, 200, route);
    const result = await response.json();
    assert.equal(result.preview_only, true);
    assert.equal(result.writes_enabled, false);
    assert.equal(result.messages_sent, 0);
    assert.doesNotMatch(JSON.stringify(result), /999999|8888888|77\/100/);
    assert.ok(data.dataCalls().some(call => call.url.pathname === '/rest/v1/donations'));
  }
});

test('verified executive previews retain source evidence and cannot adopt an unverified period label', async () => {
  for (const route of ['executive-report', 'admin-insights']) {
    const data = fixture();
    const response = await handleRulesRequest(route, request({ period_label: 'UNVERIFIED_SCOPE_2099' }), environment(), data.transport);
    assert.equal(response.status, 200, route);
    const result = await response.json();
    assert.doesNotMatch(JSON.stringify(result), /UNVERIFIED_SCOPE_2099/, route);
    assert.ok(result.evidence.some((proof: Row) => proof.row_count === 1 && Array.isArray(proof.row_ids) && proof.row_ids.includes('donation-1')), `${route} lost verified donation provenance`);
  }
});

test('assistant tasks are scoped to the authenticated user and organization, regardless of body identities', async () => {
  const data = fixture({ roles: [{ role: 'user', organization_id: ORG }], tables: { tasks: [
    { id: 'mine', organization_id: ORG, user_id: USER, title: 'My source task', status: 'pending', due_date: today() },
    { id: 'other-user', organization_id: ORG, user_id: OTHER_USER, title: 'Private other user task', status: 'pending', due_date: today() },
    { id: 'other-org', organization_id: OTHER_ORG, user_id: USER, title: 'Private other organization task', status: 'pending', due_date: today() },
    { id: 'completed', organization_id: ORG, user_id: USER, title: 'Already completed', status: 'completed', due_date: today() },
  ] } });
  const result = await streamMessage(await handleRulesRequest('employee-assistant', request({ message: 'my tasks', user_id: OTHER_USER, filters: { user_id: OTHER_USER, organization_id: OTHER_ORG } }), environment(), data.transport));
  assert.deepEqual(result.evidence.map((row: Row) => row.id), ['mine']);
  const taskCall = data.dataCalls().find(call => call.url.pathname === '/rest/v1/tasks')!;
  assert.equal(taskCall.url.searchParams.get('user_id'), `eq.${USER}`);
  assert.doesNotMatch(result.choices[0].delta.content, /Private|Already completed/);
});

test('assistant today tasks either apply the requested calendar filter or explicitly clarify without reading tasks', async () => {
  const data = fixture({ tables: { tasks: [
    { id: 'today', organization_id: ORG, user_id: USER, title: 'Due today', status: 'pending', due_date: today() },
    { id: 'old', organization_id: ORG, user_id: USER, title: 'Old task', status: 'pending', due_date: offsetDate(today(), -2) },
    { id: 'future', organization_id: ORG, user_id: USER, title: 'Future task', status: 'pending', due_date: '2099-12-31' },
  ] } });
  const result = await streamMessage(await handleRulesRequest('employee-assistant', request({ message: 'my tasks today' }), environment(), data.transport));
  if (result.intent === 'clarify') assert.equal(data.dataCalls().length, 0);
  else assert.deepEqual(result.evidence.map((row: Row) => row.id), ['today']);
  assert.doesNotMatch(result.choices[0].delta.content, /Old task|Future task/);
});

test('assistant rejects unsupported numeric date periods instead of silently using all data', async () => {
  for (const message of ['total donations last 60 days', 'كم مجموع التبرعات آخر ٦٠ يوم؟', 'كم إجمالي التبرعات في ٢٠٢٥؟']) {
    const data = fixture();
    const result = await streamMessage(await handleRulesRequest('employee-assistant', request({ message }), environment(), data.transport));
    assert.equal(result.intent, 'clarify', message);
    assert.equal(data.dataCalls().length, 0, message);
  }
});

test('overdue tasks use valid Saudi calendar dates rather than raw timestamp prefixes', async () => {
  const data = fixture({ tables: { tasks: [
    { id: 'late', organization_id: ORG, user_id: USER, title: 'Actually late', status: 'pending', due_date: offsetDate(today(), -1) },
    { id: 'saudi-today', organization_id: ORG, user_id: USER, title: 'Not overdue in Saudi Arabia', status: 'pending', due_date: `${offsetDate(today(), -1)}T22:30:00Z` },
    { id: 'invalid', organization_id: ORG, user_id: USER, title: 'Invalid source date', status: 'pending', due_date: '0000-invalid' },
  ] } });
  const result = await streamMessage(await handleRulesRequest('employee-assistant', request({ message: 'my overdue tasks' }), environment(), data.transport));
  assert.deepEqual(result.evidence.map((row: Row) => row.id), ['late']);
});

test('task preview selects stored dedupe/source metadata and suppresses completed source tasks', async () => {
  const duplicate = deterministicPreviewId(ORG, PLAN, '2026-10-01', 'content_publication:during');
  for (const prior of [
    { metadata: { source_plan_id: PLAN, template_id: 'content_publication:during' } },
    { dedupe_key: duplicate },
  ]) {
    const data = fixture({ tables: {
      operational_plans: [{ id: PLAN, organization_id: ORG, year: 2026, activity_name: 'نشر محتوى', annual_target: 2, responsible_employee_id: USER, months: [{ id: 'month-1', month: 10, monthly_target: 2 }] }],
      tasks: [{ id: UPLOAD, organization_id: ORG, title: 'Already done', user_id: USER, status: 'completed', due_date: '2026-10-01', executive_plan_id: null, phase: 'during', ...prior }],
    } });
    const response = await handleRulesRequest('automation-preview', request({ operation: 'tasks', year: 2026, months: [10] }), environment(), data.transport);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.preview_only, true);
    assert.equal(result.writes_performed, 0);
    assert.equal(result.notifications_sent, 0);
    assert.equal(result.total_preview_tasks, 1);
    assert.equal(result.tasks[0].due_date, '2026-10-04');
    assert.equal(result.skipped_tasks[0].id, duplicate);
  }
});

test('planning previews suppress foreign or unknown employees despite forged request-side directory entries', async () => {
  for (const operation of ['plans', 'tasks']) for (const employees of [
    [{ id: USER, organization_id: ORG }, { id: OTHER_USER, organization_id: OTHER_ORG }],
    [{ id: USER, organization_id: ORG }],
  ]) {
    const data = fixture({ tables: {
      employees,
      operational_plans: [{ id: PLAN, organization_id: ORG, year: 2026, activity_name: 'نشر محتوى', annual_target: 2, responsible_employee_id: OTHER_USER, months: [{ id: 'month-1', month: 10, monthly_target: 2 }] }],
    } });
    const response = await handleRulesRequest('automation-preview', request({ operation, year: 2026, months: [10], responsible_employee_id: OTHER_USER, employees: [{ id: OTHER_USER, organization_id: ORG }] }), environment(), data.transport);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.plans, []);
    if (operation === 'tasks') assert.deepEqual(result.tasks, []);
    assert.ok(result.needs_review.some((issue: Row) => issue.code === 'missing_responsibility'));
    assert.equal(result.writes_performed, 0);
    assert.equal(result.notifications_sent, 0);
    assert.ok(data.dataCalls().some(call => call.url.pathname === '/rest/v1/employees'));
  }
});

test('legacy plan generation routes return review-required previews rather than false persistence success', async () => {
  for (const route of ['generate-executive-plans', 'generate-tasks', 'generate-plan-deep', 'generate-action-plan']) {
    const data = fixture({ tables: {
      operational_plans: [{ id: PLAN, organization_id: ORG, year: 2026, activity_name: 'نشر محتوى', annual_target: 2, responsible_employee_id: USER, months: [{ id: 'month-1', month: 10, monthly_target: 2 }] }],
    } });
    const response = await handleRulesRequest(route, request({ year: 2026, months: [10] }), environment(), data.transport);
    assert.equal(response.status, 409, route);
    const result = await response.json();
    assert.equal(result.error, 'preview_requires_review');
    assert.equal(result.preview.plans.length, 2);
    if (route === 'generate-tasks') assert.equal(result.preview.tasks.length, 2);
    assert.equal(result.preview.preview_only, true);
    assert.equal(result.preview.writes_performed, 0);
    assert.equal(result.preview.notifications_sent, 0);
    assert.equal(result.success, undefined);
    assert.ok(data.calls.every(call => call.method === 'GET'));
  }
});

function endlessChunks(size: number, maxChunks: number) {
  const state = { pulls: 0, cancelled: false };
  const chunk = new Uint8Array(size).fill(32);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { state.pulls++; controller.enqueue(chunk); if (state.pulls === maxChunks) controller.close(); },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  return { body, state };
}

test('unknown-length request bodies are cancelled on byte limit before authentication', async () => {
  const source = endlessChunks(256000, 20);
  const data = fixture();
  const init = { method: 'POST', headers: { authorization: TOKEN }, body: source.body, duplex: 'half' } as RequestInit;
  const req = new Request(`${ORIGIN}/functions/v1/automation-preview`, init);
  assert.equal(req.headers.get('content-length'), null);
  const response = await handleRulesRequest('automation-preview', req, environment(), data.transport);
  assert.equal(response.status, 413);
  assert.equal(source.state.cancelled, true);
  assert.ok(source.state.pulls <= 5);
  assert.equal(data.calls.length, 0);
});

test('UTF-8 bytes, not JavaScript character counts, bound unknown-length JSON requests', async () => {
  const data = fixture();
  const response = await handleRulesRequest('automation-preview', request({ message: 'س'.repeat(500100) }), environment(), data.transport);
  assert.equal(response.status, 413);
  assert.equal(data.calls.length, 0);
});

test('unknown-length authenticated storage bodies cancel before unbounded buffering or extraction', async () => {
  const source = endlessChunks(1024 * 1024, 50);
  const data = fixture({ storage: () => new Response(source.body) });
  const response = await handleRulesRequest('analyze-uploaded-file', request({ upload_id: UPLOAD }), environment(), data.transport);
  assert.equal(response.status, 413);
  assert.equal(source.state.cancelled, true);
  assert.ok(source.state.pulls <= 32);
  assert.ok(data.calls.every(call => call.method === 'GET'));
});

test('file extraction previews preserve legacy analysis and never route, persist, or create tasks', async () => {
  const data = fixture();
  const result = await (await handleRulesRequest('analyze-uploaded-file', request({ upload_id: UPLOAD }), environment(), data.transport)).json();
  assert.equal(result.success, true);
  assert.equal(result.preview_only, true);
  assert.equal(result.legacy_analysis_preserved, true);
  assert.equal(result.routed_to, null);
  assert.equal(result.analysis.method, 'local_deterministic_extraction');
  assert.deepEqual(result.analysis.suggested_tasks, []);
  assert.deepEqual(data.tables.data_uploads_log[0].ai_analysis, { legacy: true });
});
