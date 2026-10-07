/**
 * Actual React component interaction tests with in-memory service fixtures only.
 * Pinned development dependencies make this DOM suite part of standard CI.
 * KFAAH_UI_QA_ROOT can optionally point to an isolated dependency tree.
 * Example: KFAAH_UI_QA_ROOT=/tmp/kfaah-preview-qa node --test tests/rule-approval-ui.test.ts
 * This verifies DOM/state behavior, not real-browser layout or visual appearance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repo = fileURLToPath(new URL('../', import.meta.url));
const qaRoot = process.env.KFAAH_UI_QA_ROOT || repo;
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const ORG = id(1), PLAN = id(2), MONTH = id(3), EMPLOYEE = id(4), EMPLOYEE_USER = id(5);
const day = '2026-10-04';
const selection = () => ({ organization_id: ORG, source_plan_id: PLAN, source_month_id: MONTH, assigned_employee_id: EMPLOYEE, task_dates: [day] });
const tasks = () => [{ id: 'fixture-task', title: 'تنفيذ: نشر محتوى', due_date: day, target: 10, assigned_employee_id: EMPLOYEE, metadata: { source_plan_id: PLAN, source_month_id: MONTH, template_id: 'content_publication:during' } }];
function packet(user: string, selected = selection()) {
  return {
    contract: 'rule-approved-month-v1', user_id: user, selection: selected,
    calendar: { timezone: 'Asia/Riyadh', weekend_days: [5, 6], excluded_dates: [] },
    source_plan: { id: PLAN, organization_id: ORG, responsible_employee_id: EMPLOYEE, activity_name: 'نشر محتوى', year: 2026, annual_target: 2520 },
    source_months: [{ id: MONTH, organization_id: ORG, operational_plan_id: PLAN, month: 10, monthly_target: 210 }],
    employee: { id: EMPLOYEE, organization_id: ORG, user_id: EMPLOYEE_USER, full_name: 'موظف اختبار مسمّى', status: 'active', is_viewer_account: false, updated_at: '2026-10-01T00:00:00Z' },
    tasks: selected.task_dates.map(date => ({
      dedupe_key: `fixture:${date}`, organization_id: ORG, assigned_employee_id: EMPLOYEE, user_id: EMPLOYEE_USER,
      title: 'تنفيذ: نشر محتوى', description: 'مهمة من المستهدف الشهري المحفوظ.', due_date: date, phase: 'during', target: 10,
      template_id: 'content_publication:during', status: 'upcoming', priority: 'medium', source: 'rules_approved', ai_generated: false,
      metadata: { source_plan_id: PLAN, source_month_id: MONTH, template_id: 'content_publication:during', rule_version: 'plan-rules-v1', target: 10, assignment_source: 'explicit_responsible_employee', no_quality_assessment: true,
        evidence: { source_plan_id: PLAN, source_month_id: MONTH, annual_target: 2520, monthly_target: 210, allocation: 'explicit_monthly_target', daily_allocation: 'largest_remainder_equal_workdays', rule_version: 'plan-rules-v1' } },
    })),
    preserved_tasks: [] as object[], existing_tasks: [] as object[], needs_review: [] as object[], can_commit: true,
    allocation_hash: 'a'.repeat(64), existing_executive_plans: [], prior_approved_tasks: [],
  };
}
function envelope(review: ReturnType<typeof packet>, database = false, edge = false) {
  const review_json = JSON.stringify(review);
  return { review, review_json, review_hash: createHash('sha256').update(review_json).digest('hex'), source: 'rules-v1', preview_only: true, requires_confirmation: true,
    database_enabled: database, edge_enabled: edge, writes_enabled: database && edge && review.can_commit, writes_performed: 0, notifications_sent: 0 };
}
function applied(review: ReturnType<typeof envelope>, status = 'applied') {
  return { status, organization_id: ORG, user_id: review.review.user_id, review_hash: review.review_hash,
    task_ids: review.review.tasks.map((_, i) => id(100 + i)), created_tasks: status === 'applied' ? review.review.tasks.length : 0,
    writes_performed: status === 'applied' ? review.review.tasks.length : 0, preserved_dates: review.review.preserved_tasks.length,
    notifications_sent: 0, plans_created: 0, source: 'rules-v1', preview_only: false };
}

test('reviewed-task approval: actual React DOM fixture interactions', async t => {
  const require = createRequire(join(resolve(qaRoot!), 'package.json'));
  const repositoryRequire = createRequire(join(repo, 'package.json'));
  const { PGlite } = await import(repositoryRequire.resolve('@electric-sql/pglite'));
  const db = new PGlite();
  await db.waitReady; // Initialize before installing browser globals for jsdom.
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html lang="ar" dir="rtl"><body></body></html>', { url: 'http://localhost/fixture/tasks', pretendToBeVisual: true });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Node', 'Element', 'MutationObserver', 'CustomEvent', 'Event', 'MouseEvent', 'FocusEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  for (const key of globals) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key], configurable: true, writable: true });
  }
  const folder = await mkdtemp(join(resolve(qaRoot!), 'approval-tests-'));
  try {
    const { build } = require('esbuild');
    await build({ stdin: { contents: `export { RuleApprovalPanel } from ${JSON.stringify(join(repo, 'src/components/automation/RuleApprovalPanel.tsx'))}; export { fixture } from 'fixture-service'; export { MemoryRouter } from 'react-router-dom';`, resolveDir: repo, loader: 'tsx' },
      outfile: join(folder, 'compiled.cjs'), bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'], nodePaths: [join(repo, 'node_modules'), join(resolve(qaRoot!), 'node_modules')], alias: { '@': join(repo, 'src') },
      plugins: [{ name: 'fixtures-only', setup(b) {
        b.onResolve({ filter: /^(@\/integrations\/supabase\/client|fixture-service)$/ }, () => ({ path: 'fixture-service', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const fixture={calls:[],handler:null}; export const supabase={functions:{invoke:async(name,options)=>{const call={name,body:structuredClone(options.body),signal:options.signal};fixture.calls.push(call);return fixture.handler(call)}}};`, loader: 'js' }));
      } }], logLevel: 'silent' });
    const React = require('react');
    const { render, screen, fireEvent, act, cleanup } = require('@testing-library/react');
    const { RuleApprovalPanel, fixture, MemoryRouter } = require(join(folder, 'compiled.cjs'));
    let userCount = 1000, user = '', view: { rerender: (element: unknown) => void; unmount: () => void }, props: { userId: string; organizationId: string; tasks: ReturnType<typeof tasks>; tasksPath: string }, next: ReturnType<typeof envelope>;
    const settle = async () => { await act(async () => { await new Promise(done => setTimeout(done, 15)); }); };
    const click = async (element: HTMLElement) => { await act(async () => fireEvent.click(element)); };
    const reviewButton = () => screen.getByRole('button', { name: 'مراجعة المهام المحددة' });
    const finalButton = () => screen.getByRole('button', { name: 'تأكيد حفظ المهام المحددة' });
    const rendered = () => screen.queryByRole('region', { name: 'نتيجة مراجعة الاعتماد' });
    const element = () => React.createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, React.createElement(RuleApprovalPanel, props));
    async function mount(input?: ReturnType<typeof tasks>) {
      cleanup(); user = id(++userCount); fixture.calls = []; props = { userId: user, organizationId: ORG, tasks: input || tasks(), tasksPath: '/fixture/tasks' };
      next = envelope(packet(user));
      fixture.handler = async () => ({ data: next, error: null });
      await act(async () => { view = render(element()); });
    }
    async function select() {
      const select = screen.getByRole('combobox');
      await act(async () => fireEvent.change(select, { target: { value: select.options[1].value } }));
      await click(screen.getByRole('checkbox', { name: `مراجعة يوم ${day}` }));
    }
    async function reviewed(enabled = false) { await select(); next = envelope(packet(user), enabled, enabled); await click(reviewButton()); await settle(); }
    async function confirm() { await click(screen.getByRole('checkbox', { name: /راجعت الموظف والأيام/ })); }
    async function scenario(name: string, fn: () => Promise<void>) { await t.test(name, async () => { await mount(); await fn(); }); }

    await scenario('render is read-only and nothing is selected implicitly', async () => { assert.equal(fixture.calls.length, 0); assert.equal(reviewButton().disabled, true); assert.equal(screen.getByRole('combobox').value, ''); });
    await scenario('annual-only source cannot be submitted', async () => { await mount(tasks().map(task => ({ ...task, metadata: { ...task.metadata, source_month_id: null } }))); assert.match(document.body.textContent!, /يلزم مستهدف شهري محفوظ/); assert.equal(screen.queryByRole('button', { name: 'مراجعة المهام المحددة' }), null); assert.equal(fixture.calls.length, 0); });
    await scenario('review sends only exact selectors and displays named employee, dates, titles and targets with both switches off', async () => {
      await reviewed(); assert.deepEqual(fixture.calls[0].body, { action: 'review', ...selection() }); assert.equal(fixture.calls[0].name, 'apply-rule-preview');
      assert(rendered()); assert.match(rendered().textContent, /موظف اختبار مسمّى/); assert.match(rendered().textContent, /2026-10-04/); assert.match(rendered().textContent, /المستهدف الشهري/); assert.match(rendered().textContent, /بوابة قاعدة البيانات: معطّلة/); assert.match(rendered().textContent, /بوابة خدمة الحفظ: معطّلة/); assert.equal(finalButton().disabled, true); assert.equal(screen.getByRole('checkbox', { name: /راجعت الموظف والأيام/ }).disabled, true); assert.equal(fixture.calls.length, 1);
    });
    await scenario('each disabled server gate independently prevents confirmation', async () => {
      await select();
      for (const [database, edge] of [[true, false], [false, true]]) { next = envelope(packet(user), database, edge); await click(reviewButton()); await settle(); assert(rendered()); assert.equal(finalButton().disabled, true); }
    });
    await scenario('needs_review and preserved rows are visible and block saving', async () => {
      await select(); const review = packet(user); const existing = { id: id(80), status: 'completed', due_date: day, dedupe_key: null, metadata: {}, phase: 'during', executive_plan_id: null, source_activity_id: null, updated_at: null, source: 'manual', assigned_employee_id: EMPLOYEE, user_id: EMPLOYEE_USER };
      review.tasks = []; review.existing_tasks = [existing]; review.preserved_tasks = [{ date: day, existing: [existing] }]; review.needs_review = [{ code: 'historical_target_requires_review', task_id: id(80) }]; review.can_commit = false; next = envelope(review, true, true);
      await click(reviewButton()); await settle(); assert(rendered()); assert.match(rendered().textContent, /completed/); assert.match(rendered().textContent, /مطابقة بشرية/); assert.equal(finalButton().disabled, true);
    });
    await scenario('only explicit checkbox and final click submit once, with returned hash and no task payload', async () => {
      await reviewed(true); assert.equal(finalButton().disabled, true); await confirm(); assert.equal(finalButton().disabled, false); fixture.handler = async () => ({ data: applied(next), error: null });
      await act(async () => { fireEvent.click(finalButton()); fireEvent.click(finalButton()); }); await settle();
      assert.equal(fixture.calls.length, 2); assert.deepEqual(fixture.calls[1].body, { action: 'commit', ...selection(), confirmed: true, review_hash: next.review_hash }); assert.match(document.body.textContent!, /حُفظت/); assert.equal(rendered(), null);
    });
    await scenario('idempotent replay reports zero newly created tasks', async () => { await reviewed(true); await confirm(); fixture.handler = async () => ({ data: applied(next, 'already_applied'), error: null }); await click(finalButton()); await settle(); assert.match(document.body.textContent!, /سبق تطبيق هذا الاعتماد/); assert.equal(fixture.calls.length, 2); });
    await scenario('changing source group cancels review and never mixes plans, months or employees', async () => {
      const other = { ...tasks()[0], id: 'other-plan-task', title: 'تنفيذ: إعداد تقرير', metadata: { ...tasks()[0].metadata, source_plan_id: id(20), source_month_id: id(21) }, assigned_employee_id: id(22) };
      await mount([...tasks(), other]); await select(); let resolveResponse: (value: unknown) => void; fixture.handler = () => new Promise(resolve => { resolveResponse = resolve; }); await click(reviewButton());
      const selectElement = screen.getByRole('combobox'); await act(async () => fireEvent.change(selectElement, { target: { value: selectElement.options[2].value } }));
      assert.equal(fixture.calls[0].signal.aborted, true); assert.equal(screen.getByRole('checkbox', { name: `مراجعة يوم ${day}` }).checked, false);
      await act(async () => resolveResponse({ data: next, error: null })); await settle(); assert.equal(rendered(), null);
      await click(screen.getByRole('checkbox', { name: `مراجعة يوم ${day}` })); fixture.handler = async () => ({ data: next, error: null }); await click(reviewButton()); await settle();
      assert.deepEqual(fixture.calls[1].body, { action: 'review', ...selection(), source_plan_id: id(20), source_month_id: id(21), assigned_employee_id: id(22) }); assert.equal(rendered(), null);
    });
    await scenario('ambiguous duplicate preview date never offers a commit group', async () => { await mount([...tasks(), { ...tasks()[0], id: 'duplicate-date' }]); assert.equal(screen.queryByRole('combobox'), null); assert.equal(fixture.calls.length, 0); });
    await scenario('review double-click cannot enqueue duplicate requests', async () => { await select(); await act(async () => { fireEvent.click(reviewButton()); fireEvent.click(reviewButton()); }); await settle(); assert.equal(fixture.calls.length, 1); });

    const malformed: [string, (value: ReturnType<typeof envelope>) => void][] = [
      ['incorrect hash', value => { value.review_hash = '0'.repeat(64); }],
      ['missing edge gate', value => { delete (value as unknown as Record<string, unknown>).edge_enabled; }],
      ['inconsistent active gate', value => { value.writes_enabled = true; }],
      ['mismatched review object and signed JSON', value => { value.review.employee.full_name = 'اسم مختلف'; }],
      ['cross-user review', value => { value.review.user_id = id(999); Object.assign(value, envelope(value.review)); }],
      ['cross-organization task', value => { value.review.tasks[0].organization_id = id(999); Object.assign(value, envelope(value.review)); }],
      ['changed employee', value => { value.review.employee.id = id(999); Object.assign(value, envelope(value.review)); }],
      ['missing employee name', value => { value.review.employee.full_name = ''; Object.assign(value, envelope(value.review)); }],
      ['changed selector dates', value => { value.review.selection.task_dates = ['2026-10-05']; Object.assign(value, envelope(value.review)); }],
      ['task outside selected dates', value => { value.review.tasks[0].due_date = '2026-10-05'; Object.assign(value, envelope(value.review)); }],
      ['wrong monthly provenance', value => { value.review.tasks[0].metadata.source_month_id = id(999); Object.assign(value, envelope(value.review)); }],
      ['malformed nested task title', value => { (value.review.tasks[0] as unknown as Record<string, unknown>).title = {}; Object.assign(value, envelope(value.review)); }],
      ['unaccounted selected date', value => { value.review.tasks = []; Object.assign(value, envelope(value.review)); }],
      ['missing preserved-task evidence', value => { value.review.tasks = []; value.review.preserved_tasks = [{ date: day, existing: [] }]; Object.assign(value, envelope(value.review)); }],
    ];
    for (const [name, mutate] of malformed) await scenario(`rejects successful HTTP payload with ${name}`, async () => { await select(); mutate(next); await click(reviewButton()); await settle(); assert.equal(rendered(), null); assert.match(screen.getByRole('alert').textContent, /تعذر التحقق/); assert.equal(fixture.calls.length, 1); });
    await scenario('valid signed JSON with different object key order remains accepted', async () => { await select(); next.review = Object.fromEntries(Object.entries(next.review).reverse()) as ReturnType<typeof packet>; await click(reviewButton()); await settle(); assert(rendered()); });
    await scenario('known stale-review denial invalidates confirmation and requires a new review', async () => { await reviewed(true); await confirm(); fixture.handler = async () => ({ data: null, error: { context: new Response(JSON.stringify({ error: 'approval_stale_review', message: 'تغيرت بيانات المصدر؛ راجع نسخة جديدة.' }), { status: 409 }) } }); await click(finalButton()); await settle(); assert.equal(rendered(), null); assert.match(screen.getByRole('alert').textContent, /تغيرت بيانات المصدر/); assert.equal(reviewButton().disabled, false); assert.equal(fixture.calls.length, 2); });
    for (const failure of ['network', 'bad hash', 'bad counts', 'nonzero notifications', 'wrong user']) await scenario(`uncertain commit ${failure} stops all retries until task-list check acknowledged`, async () => {
      await reviewed(true); await confirm(); fixture.handler = async () => {
        if (failure === 'network') throw new Error('connection lost'); const result = applied(next);
        if (failure === 'bad hash') result.review_hash = 'b'.repeat(64); if (failure === 'bad counts') result.created_tasks = 9;
        if (failure === 'nonzero notifications') result.notifications_sent = 1; if (failure === 'wrong user') result.user_id = id(999);
        return { data: result, error: null };
      }; await click(finalButton()); await settle(); assert.equal(rendered(), null); assert.equal(reviewButton().disabled, true); assert.match(document.body.textContent!, /قد تكون المهام حُفظت بالفعل/); await settle(); assert.equal(fixture.calls.length, 2); assert.equal(screen.getByRole('link', { name: 'فتح قائمة المهام للتحقق' }).getAttribute('href'), '/fixture/tasks'); await click(screen.getByRole('button', { name: 'راجعت قائمة المهام؛ بدء مراجعة جديدة' })); assert.equal(reviewButton().disabled, false); assert.equal(fixture.calls.length, 2);
    });
    await scenario('cancel review aborts and ignores a late service response', async () => {
      await select(); let resolveResponse: (value: unknown) => void; fixture.handler = () => new Promise(resolve => { resolveResponse = resolve; }); await click(reviewButton()); await click(screen.getByRole('button', { name: 'إلغاء المراجعة' })); assert.equal(fixture.calls[0].signal.aborted, true); await act(async () => resolveResponse({ data: next, error: null })); await settle(); assert.equal(rendered(), null);
    });
    await scenario('date changes cancel in-flight reviews and clear old confirmation', async () => {
      await reviewed(true); await confirm(); await click(screen.getByRole('checkbox', { name: `مراجعة يوم ${day}` })); assert.equal(rendered(), null); assert.equal(reviewButton().disabled, true);
      await click(screen.getByRole('checkbox', { name: `مراجعة يوم ${day}` })); let resolveResponse: (value: unknown) => void; fixture.handler = () => new Promise(resolve => { resolveResponse = resolve; }); await click(reviewButton()); await click(screen.getByRole('checkbox', { name: `مراجعة يوم ${day}` })); assert.equal(fixture.calls.at(-1).signal.aborted, true); await act(async () => resolveResponse({ data: next, error: null })); await settle(); assert.equal(rendered(), null);
    });
    for (const change of ['organization', 'user', 'preview']) await scenario(`${change} change immediately clears state and rejects late old review`, async () => {
      await select(); let resolveResponse: (value: unknown) => void; fixture.handler = () => new Promise(resolve => { resolveResponse = resolve; }); await click(reviewButton());
      if (change === 'organization') props = { ...props, organizationId: id(90) }; if (change === 'user') props = { ...props, userId: id(91) }; if (change === 'preview') props = { ...props, tasks: tasks().map(task => ({ ...task, target: 11 })) };
      await act(async () => view.rerender(element())); assert.equal(fixture.calls[0].signal.aborted, true); assert.equal(screen.getByRole('combobox').value, ''); await act(async () => resolveResponse({ data: next, error: null })); await settle(); assert.equal(rendered(), null);
    });
    await scenario('unmount during commit records scoped uncertainty and never resurrects a review', async () => {
      await reviewed(true); await confirm(); let resolveResponse: (value: unknown) => void; fixture.handler = () => new Promise(resolve => { resolveResponse = resolve; }); await click(finalButton()); await act(async () => view.unmount()); assert.equal(fixture.calls.at(-1).signal.aborted, true); await act(async () => resolveResponse({ data: applied(next), error: null })); await settle(); await act(async () => { view = render(element()); }); assert.equal(rendered(), null); assert.match(document.body.textContent!, /يلزم التحقق من قائمة المهام/); assert.equal(reviewButton().disabled, true);
      props = { ...props, organizationId: id(98) }; await act(async () => view.rerender(element())); assert.doesNotMatch(document.body.textContent!, /يلزم التحقق من قائمة المهام/); assert.equal(fixture.calls.length, 2);
    });
    await scenario('real embedded PostgreSQL review/commit packets render, save and preserve prior approved rows', async () => {
      try {
        await db.exec(`
          CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth;
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
          CREATE FUNCTION public.admin_can_access_org(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
          GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
          CREATE TABLE public.user_organizations(id uuid DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,approval_status text);
          CREATE TABLE public.user_roles(id uuid DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,role text);
          CREATE TABLE public.employees(id uuid PRIMARY KEY,organization_id uuid,user_id uuid,full_name text,status text,is_viewer_account boolean,updated_at timestamptz DEFAULT now());
          CREATE TABLE public.operational_plans(id uuid PRIMARY KEY,organization_id uuid,year integer,activity_name text,annual_target numeric,responsible_employee_id uuid,status text,estimated_budget numeric DEFAULT 0,updated_at timestamptz DEFAULT now());
          CREATE TABLE public.operational_plan_months(id uuid PRIMARY KEY,organization_id uuid,operational_plan_id uuid REFERENCES public.operational_plans(id),month integer,monthly_target numeric);
          CREATE TABLE public.executive_plans(id uuid PRIMARY KEY,organization_id uuid,operational_plan_month_id uuid REFERENCES public.operational_plan_months(id),day integer,status text,daily_target numeric,achieved numeric);
          CREATE TABLE public.tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,assigned_employee_id uuid REFERENCES public.employees(id),title text NOT NULL,description text,due_date date,priority text,status text,source text,ai_generated boolean,phase text,dedupe_key text,metadata jsonb DEFAULT '{}',executive_plan_id uuid REFERENCES public.executive_plans(id),source_activity_id uuid REFERENCES public.executive_plans(id),category text,actual_time_minutes integer,completed_at timestamptz,completion_percentage numeric,estimated_time_minutes integer,quality_percentage numeric,started_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
          GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
          ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
          CREATE POLICY fixture_tasks ON public.tasks TO authenticated USING(organization_id = current_setting('fixture.org')::uuid) WITH CHECK(organization_id = current_setting('fixture.org')::uuid);
          CREATE FUNCTION public.get_user_organization_id(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('fixture.org')::uuid $$;
          CREATE FUNCTION public.set_organization_id_on_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.organization_id IS NULL THEN NEW.organization_id := public.get_user_organization_id(auth.uid()); END IF; RETURN NEW; END; $$;
          CREATE TRIGGER set_org_id_tasks BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
          INSERT INTO public.user_organizations(user_id,organization_id,approval_status) VALUES ('${user}','${ORG}','approved'),('${EMPLOYEE_USER}','${ORG}','approved');
          INSERT INTO public.user_roles(user_id,organization_id,role) VALUES ('${user}','${ORG}','admin');
          INSERT INTO public.employees(id,organization_id,user_id,full_name,status,is_viewer_account) VALUES ('${EMPLOYEE}','${ORG}','${EMPLOYEE_USER}','موظف اختبار مسمّى','active',false);
          INSERT INTO public.operational_plans(id,organization_id,year,activity_name,annual_target,responsible_employee_id,status) VALUES ('${PLAN}','${ORG}',2026,'نشر محتوى',2520,'${EMPLOYEE}','active');
          INSERT INTO public.operational_plan_months VALUES('${MONTH}','${ORG}','${PLAN}',10,210);
          SELECT set_config('request.jwt.claim.sub','${user}',false),set_config('fixture.org','${ORG}',false);
        `);
        await db.exec(await readFile(join(repo, 'drizzle/migrations/0025_rule_approved_previews.sql'), 'utf8'));
        fixture.handler = async ({ body }: { body: ReturnType<typeof selection> & { action: string; review_hash?: string } }) => {
          const { action, review_hash, ...selectors } = body;
          delete (selectors as Record<string, unknown>).confirmed;
          const response = action === 'review'
            ? await db.query('SELECT public.review_rule_month($1::jsonb) AS value', [JSON.stringify(selectors)])
            : await db.query('SELECT public.apply_rule_month($1::jsonb,$2,true) AS value', [JSON.stringify(selectors), review_hash]);
          const data = response.rows[0].value;
          return { data: action === 'review' ? { ...data, review: JSON.parse(data.review_json), source: 'rules-v1', preview_only: true, requires_confirmation: true, edge_enabled: true, writes_enabled: data.database_enabled && JSON.parse(data.review_json).can_commit, writes_performed: 0, notifications_sent: 0 } : { ...data, source: 'rules-v1', preview_only: false }, error: null };
        };
        await select(); await click(reviewButton()); await settle(); assert(rendered(), document.body.textContent!); assert.equal(finalButton().disabled, true);
        await db.exec('UPDATE rule_approval_private.settings SET enabled=true'); // In-memory fixture only.
        await click(reviewButton()); await settle(); assert(rendered(), document.body.textContent!); await confirm(); await click(finalButton()); await settle(); assert.match(document.body.textContent!, /حُفظت/);
        const inserted = await db.query('SELECT count(*)::integer AS count FROM public.tasks'); assert.equal(inserted.rows[0].count, 1);
        props = { ...props, tasks: [...tasks(), { ...tasks()[0], id: 'fixture-task-2', due_date: '2026-10-05' }] };
        await act(async () => view.rerender(element())); await select(); await click(screen.getByRole('checkbox', { name: 'مراجعة يوم 2026-10-05' })); await click(reviewButton()); await settle();
        assert(rendered(), document.body.textContent!); assert.match(rendered().textContent, /upcoming/); assert.match(rendered().textContent, /أيام مختارة تغطيها مهام قائمة: 2026-10-04/); assert.equal(fixture.calls.filter(call => call.body.action === 'commit').length, 1);
      } finally { /* The isolated database is closed with the outer harness. */ }
    });
    cleanup();
  } finally {
    await db.close();
    dom.window.close();
    for (const key of globals) { const original = originals.get(key); if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); }
    await rm(folder, { recursive: true, force: true });
  }
});
