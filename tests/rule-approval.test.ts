import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleRuleApprovalRequest, parseApprovalRequest, verifyReviewEnvelope, sha256Text, APPROVAL_CONTRACT } from '../supabase/functions/_shared/rule-approval.ts';
import { previewTasks, workingDates } from '../supabase/functions/_shared/rule-plans.ts';

const ORG = '22222222-2222-4222-8222-222222222222';
const USER = '11111111-1111-4111-8111-111111111111';
const EMPLOYEE = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE_USER = '44444444-4444-4444-8444-444444444444';
const PLAN = '55555555-5555-4555-8555-555555555555';
const MONTH = '66666666-6666-4666-8666-666666666666';
const OTHER = '77777777-7777-4777-8777-777777777777';
const ORIGIN = 'https://platform.invalid';
const TOKEN = 'Bearer fixture-user-only';
const selection = () => ({ organization_id: ORG, source_plan_id: PLAN, source_month_id: MONTH, assigned_employee_id: EMPLOYEE, task_dates: ['2026-10-04', '2026-10-05'] });
const request = (body: unknown) => new Request(`${ORIGIN}/functions/v1/apply-rule-preview`, { method: 'POST', headers: { authorization: TOKEN }, body: JSON.stringify(body) });
const env = (enabled = false) => (key: string) => ({ SUPABASE_URL: ORIGIN, SUPABASE_ANON_KEY: 'fixture-anon', KFAAH_RULE_PERSISTENCE: enabled ? 'approved_month_v1' : undefined, KFAAH_AUTOMATION_MODE: 'legacy_ai' })[key];
async function envelope(user = USER, selectors = selection()) {
  const review_json = JSON.stringify({ contract: APPROVAL_CONTRACT, user_id: user, selection: selectors, tasks: [], preserved_tasks: [] });
  return { review_json, review_hash: await sha256Text(review_json), database_enabled: true };
}
function transport(rpc: (path: string, body: Record<string, unknown>) => Response | Promise<Response>, role = 'admin') {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    assert.equal(url.origin, ORIGIN);
    assert.equal(new Headers(init?.headers).get('Authorization'), TOKEN);
    assert.equal(new Headers(init?.headers).get('apikey'), 'fixture-anon');
    assert.equal(init?.redirect, 'error');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: USER });
    if (url.pathname === '/rest/v1/user_organizations') return Response.json([{ organization_id: ORG, approval_status: 'approved' }]);
    if (url.pathname === '/rest/v1/user_roles') return Response.json([{ role, organization_id: ORG }]);
    assert.equal(init?.method, 'POST');
    return rpc(url.pathname, JSON.parse(String(init?.body)));
  }) as typeof fetch;
  return { fetcher, calls };
}

test('approval requests accept only normalized selectors and explicit commit confirmation', () => {
  assert.deepEqual(parseApprovalRequest({ action: 'review', ...selection(), task_dates: ['2026-10-05', '2026-10-04'] }), { action: 'review', ...selection() });
  for (const extra of [{ tasks: [] }, { amount: 2 }, { role: 'admin' }, { calendar: {} }, { confirmed: true }]) assert.throws(() => parseApprovalRequest({ action: 'review', ...selection(), ...extra }));
  for (const confirmed of [false, 'true', 1, null, undefined]) assert.throws(() => parseApprovalRequest({ action: 'commit', ...selection(), review_hash: 'a'.repeat(64), confirmed }), /راجع المعاينة/);
  assert.equal(parseApprovalRequest({ action: 'commit', ...selection(), review_hash: 'a'.repeat(64), confirmed: true }).action, 'commit');
});

test('invalid dates, duplicate dates, cross-month selections and arbitrary payloads are rejected', () => {
  for (const task_dates of [[], ['2026-02-30'], ['2026-10-04', '2026-10-04'], ['2026-10-04', '2026-11-04'], [3], ['2026-10-04T00:00:00Z'], Array.from({ length: 32 }, () => '2026-10-04')]) assert.throws(() => parseApprovalRequest({ action: 'review', ...selection(), task_dates }));
  for (const key of ['organization_id', 'source_plan_id', 'source_month_id', 'assigned_employee_id']) assert.throws(() => parseApprovalRequest({ action: 'review', ...selection(), [key]: 'untrusted' }));
  for (const hash of ['', 'f'.repeat(63), 'G'.repeat(64), 'f'.repeat(65)]) assert.throws(() => parseApprovalRequest({ action: 'commit', ...selection(), confirmed: true, review_hash: hash }));
});

test('review hash binds exact server JSON, current user, organization and selection', async () => {
  const valid = await envelope();
  assert.ok((await verifyReviewEnvelope(valid, selection(), USER)).review);
  for (const broken of [{ ...valid, review_hash: '0'.repeat(64) }, { ...valid, review_json: valid.review_json + ' ' }, await envelope(OTHER), await envelope(USER, { ...selection(), organization_id: OTHER })]) await assert.rejects(verifyReviewEnvelope(broken, selection(), USER));
});

test('review invokes only user-scoped platform RPC even when legacy AI mode is requested', async () => {
  const mocked = transport(async (path, body) => { assert.equal(path, '/rest/v1/rpc/review_rule_month'); assert.deepEqual(body, { p_selection: selection() }); return Response.json(await envelope()); });
  const response = await handleRuleApprovalRequest(request({ action: 'review', ...selection() }), env(), mocked.fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.writes_enabled, false); assert.equal(result.preview_only, true); assert.equal(result.writes_performed, 0);
  assert.equal(mocked.calls.length, 4);
});

test('commit is default-off and never calls database apply while disabled', async () => {
  const mocked = transport(() => { throw new Error('RPC must not execute'); });
  const response = await handleRuleApprovalRequest(request({ action: 'commit', ...selection(), review_hash: 'a'.repeat(64), confirmed: true }), env(), mocked.fetcher);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'approval_persistence_disabled');
  assert.equal(mocked.calls.length, 3);
});

test('commit maps stale review, accepts verified receipt and performs no automatic retry', async () => {
  for (const [status, data] of [[409, { message: 'approval_stale_review' }], [200, { status: 'already_applied', organization_id: ORG, user_id: USER, review_hash: 'a'.repeat(64) }]] as const) {
    const mocked = transport((path, body) => { assert.equal(path, '/rest/v1/rpc/apply_rule_month'); assert.deepEqual(body, { p_selection: selection(), p_review_hash: 'a'.repeat(64), p_confirmed: true }); return Response.json(data, { status }); });
    const response = await handleRuleApprovalRequest(request({ action: 'commit', ...selection(), confirmed: true, review_hash: 'a'.repeat(64) }), env(true), mocked.fetcher);
    assert.equal(response.status, status); assert.equal(mocked.calls.length, 4);
  }
});

test('manager previews cannot expand to moderator task assignment, and cross-org requests fail', async () => {
  for (const [role, org] of [['moderator', ORG], ['admin', OTHER]]) {
    const mocked = transport(() => { throw new Error('unexpected RPC'); }, role);
    const response = await handleRuleApprovalRequest(request({ action: 'review', ...selection(), organization_id: org }), env(), mocked.fetcher);
    assert.equal(response.status, 403); assert.equal(mocked.calls.length, 3);
  }
});

test('uncertain network failure after dispatch never retries or claims that nothing changed', async () => {
  const mocked = transport(() => { throw new TypeError('fixture disconnected after dispatch'); });
  const response = await handleRuleApprovalRequest(request({ action: 'commit', ...selection(), confirmed: true, review_hash: 'a'.repeat(64) }), env(true), mocked.fetcher);
  assert.equal(response.status,503); assert.equal((await response.json()).error,'approval_result_unknown');
  assert.equal(mocked.calls.filter(path => path.includes('/rpc/')).length,1);
});

test('oversized streamed bodies and unexpected methods fail without network calls', async () => {
  const failFetch = (async () => { throw new Error('unexpected I/O'); }) as typeof fetch;
  const body = '{"padding":"' + 'x'.repeat(20_000) + '"}';
  const response = await handleRuleApprovalRequest(new Request(ORIGIN, { method: 'POST', body }), env(), failFetch);
  assert.equal(response.status, 413);
  assert.equal((await handleRuleApprovalRequest(new Request(ORIGIN), env(), failFetch)).status, 405);
});

// Real PostgreSQL-in-WASM integration suite. No live connection, credentials,
// or production records. The pinned development dependency runs in CI as well.
const pgliteModule = process.env.KFAAH_PGLITE_MODULE || '@electric-sql/pglite';
test('atomic SQL contract on an isolated embedded PostgreSQL fixture', async t => {
  const { PGlite } = await import(pgliteModule!);
  const db = new PGlite();
  const sql = (value: string) => db.exec(value);
  const query = async (value: string, params: unknown[] = []) => (await db.query(value, params)).rows;
  await sql(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
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
    INSERT INTO public.user_organizations(user_id,organization_id,approval_status) VALUES ('${USER}','${ORG}','approved'),('${EMPLOYEE_USER}','${ORG}','approved');
    INSERT INTO public.user_roles(user_id,organization_id,role) VALUES ('${USER}','${ORG}','admin');
    INSERT INTO public.employees(id,organization_id,user_id,full_name,status,is_viewer_account) VALUES ('${EMPLOYEE}','${ORG}','${EMPLOYEE_USER}','Fixture Employee','active',false);
    INSERT INTO public.operational_plans(id,organization_id,year,activity_name,annual_target,responsible_employee_id,status) VALUES ('${PLAN}','${ORG}',2026,'نشر محتوى',600,'${EMPLOYEE}','active');
    INSERT INTO public.operational_plan_months VALUES('${MONTH}','${ORG}','${PLAN}',10,50);
    SELECT set_config('request.jwt.claim.sub','${USER}',false),set_config('fixture.org','${ORG}',false);
  `);
  await sql(readFileSync(new URL('../drizzle/migrations/0025_rule_approved_previews.sql', import.meta.url), 'utf8'));
  const review = async (s = selection()) => { const [row] = await query('SELECT public.review_rule_month($1::jsonb) AS value', [JSON.stringify(s)]); return row.value; };
  const apply = async (hash: string, s = selection(), confirmed = true) => { const [row] = await query('SELECT public.apply_rule_month($1::jsonb,$2,$3) AS value', [JSON.stringify(s), hash, confirmed]); return row.value; };
  await t.test('database gate defaults off; role has no login, superuser or RLS bypass', async () => {
    const value = await review(); assert.equal(value.database_enabled, false);
    await assert.rejects(apply(value.review_hash), /approval_persistence_disabled/);
    const [role] = await query("SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='kfaah_rule_executor'");
    assert.deepEqual(role, { rolcanlogin: false, rolsuper: false, rolbypassrls: false });
  });
  await sql('UPDATE rule_approval_private.settings SET enabled=true');
  await t.test('SQL allocations match shared rules, selected dates never multiply target', async () => {
    const value = await review();
    await verifyReviewEnvelope(value, selection(), USER);
    const packet = JSON.parse(value.review_json);
    assert.ok(packet.tasks.length > 0 && packet.tasks.every((row: Record<string, unknown>) => row.status === "upcoming"));
    const local = previewTasks({ organization_id: ORG, year: 2026, months: [10], plans: [{ id: PLAN, organization_id: ORG, year: 2026, activity_name: 'نشر محتوى', annual_target: 600, responsible_employee_id: EMPLOYEE, months: [{ id: MONTH, month: 10, monthly_target: 50 }] }] });
    assert.deepEqual(packet.tasks.map((row: Record<string, unknown>) => [row.due_date,row.target,row.dedupe_key]), local.tasks.filter(row => selection().task_dates.includes(row.due_date)).map(row => [row.due_date,row.target,row.dedupe_key]));
    assert.equal(local.tasks.reduce((sum,row) => sum + row.target!,0),50);
  });
  await t.test('explicit confirmation, source employee and scope are enforced in SQL', async () => {
    const value = await review();
    await assert.rejects(apply(value.review_hash, selection(), false), /approval_confirmation_required/);
    await assert.rejects(review({ ...selection(), assigned_employee_id: OTHER }), /approval_source_not_found/);
    await assert.rejects(review({ ...selection(), organization_id: OTHER }), /approval_forbidden/);
    await assert.rejects(review({ ...selection(), task_dates: ['2026-10-02'] }), /approval_invalid_selection/);
    await sql(`UPDATE employees SET is_viewer_account=true WHERE id='${EMPLOYEE}'`);
    await assert.rejects(review(), /approval_source_requires_review/);
    await sql(`UPDATE employees SET is_viewer_account=false WHERE id='${EMPLOYEE}'`);
  });
  await t.test('stale review cannot write after target edits', async () => {
    const value = await review();
    await sql(`UPDATE operational_plan_months SET monthly_target=51 WHERE id='${MONTH}'`);
    await assert.rejects(apply(value.review_hash), /approval_stale_review/);
    assert.equal((await query('SELECT count(*)::integer AS n FROM tasks'))[0].n,0);
    await sql(`UPDATE operational_plan_months SET monthly_target=50 WHERE id='${MONTH}'`);
  });
  await t.test('source completeness, employee linkage and current role cannot be bypassed', async () => {
    for (const [change, restore] of [
      [`UPDATE employees SET user_id=NULL WHERE id='${EMPLOYEE}'`, `UPDATE employees SET user_id='${EMPLOYEE_USER}' WHERE id='${EMPLOYEE}'`],
      [`UPDATE employees SET organization_id='${OTHER}' WHERE id='${EMPLOYEE}'`, `UPDATE employees SET organization_id='${ORG}' WHERE id='${EMPLOYEE}'`],
      [`UPDATE operational_plans SET status='completed' WHERE id='${PLAN}'`, `UPDATE operational_plans SET status='active' WHERE id='${PLAN}'`],
      [`UPDATE operational_plans SET activity_name='unknown source' WHERE id='${PLAN}'`, `UPDATE operational_plans SET activity_name='نشر محتوى' WHERE id='${PLAN}'`],
      [`UPDATE operational_plan_months SET monthly_target=601 WHERE id='${MONTH}'`, `UPDATE operational_plan_months SET monthly_target=50 WHERE id='${MONTH}'`],
      [`UPDATE user_organizations SET approval_status='pending' WHERE user_id='${EMPLOYEE_USER}'`, `UPDATE user_organizations SET approval_status='approved' WHERE user_id='${EMPLOYEE_USER}'`],
      [`UPDATE user_roles SET organization_id='${OTHER}' WHERE user_id='${USER}'`, `UPDATE user_roles SET organization_id='${ORG}' WHERE user_id='${USER}'`],
    ]) {
      await sql(change); await assert.rejects(review(), /approval_(source_not_found|source_requires_review|forbidden)/); await sql(restore);
    }
  });
  await t.test('same source hash is independent of database session timezone and date style', async () => {
    const value = await review();
    await sql("SET DateStyle = 'German, DMY'; SET TimeZone = 'Pacific/Honolulu'");
    assert.equal((await review()).review_hash, value.review_hash);
    await sql("SET DateStyle = 'ISO, YMD'; SET TimeZone = 'UTC'");
  });
  await t.test('existing daily plans and completed work invalidate review and block implicit redistribution', async () => {
    const stale = await review();
    await sql(`INSERT INTO executive_plans VALUES('${OTHER}','${ORG}','${MONTH}',4,'completed',3,3)`);
    const changed = await review(); const packet = JSON.parse(changed.review_json);
    assert.notEqual(changed.review_hash,stale.review_hash); assert.equal(packet.can_commit,false);
    assert.equal(packet.existing_executive_plans[0].status,'completed');
    await assert.rejects(apply(stale.review_hash), /approval_stale_review/);
    await assert.rejects(apply(changed.review_hash), /approval_source_requires_review/);
    assert.equal((await query('SELECT count(*)::integer AS n FROM tasks'))[0].n,0);
    await sql(`DELETE FROM executive_plans WHERE id='${OTHER}'`);
  });
  await t.test('batch insert and receipt roll back together if a later row fails', async () => {
    const value = await review();
    await sql("ALTER TABLE tasks ADD CONSTRAINT fixture_reject_second CHECK (due_date <> DATE '2026-10-05')");
    await assert.rejects(apply(value.review_hash), /fixture_reject_second/);
    assert.equal((await query('SELECT count(*)::integer AS n FROM tasks'))[0].n,0);
    assert.equal((await query('SELECT count(*)::integer AS n FROM rule_approval_private.receipts'))[0].n,0);
    await sql('ALTER TABLE tasks DROP CONSTRAINT fixture_reject_second');
  });
  await t.test('unknown insert hook and changed allowlisted function body fail closed', async () => {
    const value = await review();
    await sql(`CREATE FUNCTION public.fixture_hook() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$; CREATE TRIGGER fixture_hook AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION public.fixture_hook();`);
    await assert.rejects(apply(value.review_hash), /approval_unsafe_database_hooks/);
    await sql('DROP TRIGGER fixture_hook ON tasks');
    await sql(`CREATE OR REPLACE FUNCTION public.set_organization_id_on_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END; $$;`);
    await assert.rejects(apply(value.review_hash), /approval_unsafe_database_hooks/);
    await sql(`CREATE OR REPLACE FUNCTION public.set_organization_id_on_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.organization_id IS NULL THEN NEW.organization_id := public.get_user_organization_id(auth.uid()); END IF; RETURN NEW; END; $$;`);
    await sql('ALTER TABLE tasks ADD COLUMN fixture_unknown text DEFAULT \'unreviewed\'');
    await assert.rejects(apply(value.review_hash), /approval_unsafe_database_hooks/);
    await sql('ALTER TABLE tasks DROP COLUMN fixture_unknown');
  });
  await t.test('RLS remains effective and clients cannot access private receipts', async () => {
    await sql('SET ROLE authenticated');
    await assert.rejects(query('SELECT * FROM rule_approval_private.receipts'), /permission denied/);
    await sql('RESET ROLE');
    await sql(`SELECT set_config('fixture.org','${OTHER}',false)`);
    const value = await review();
    await assert.rejects(apply(value.review_hash), /row-level security/);
    assert.equal((await query('SELECT count(*)::integer AS n FROM rule_approval_private.receipts'))[0].n,0);
    await sql(`SELECT set_config('fixture.org','${ORG}',false)`);
  });
  await t.test('unknown manual completed coverage blocks further allocation and is never modified', async () => {
    const stale = await review();
    await sql(`INSERT INTO tasks(id,organization_id,user_id,assigned_employee_id,title,status,due_date,metadata,source,completed_at) VALUES('${OTHER}','${ORG}','${EMPLOYEE_USER}','${EMPLOYEE}','Keep manual result','completed','2026-10-04','{"source_plan_id":"${PLAN}"}','manual',now())`);
    await assert.rejects(apply(stale.review_hash), /approval_stale_review/);
    const before = await query(`SELECT to_jsonb(t) AS row FROM tasks t WHERE id='${OTHER}'`);
    const value = await review(); const packet = JSON.parse(value.review_json);
    assert.equal(packet.tasks.length,1); assert.equal(packet.preserved_tasks.length,1);
    assert.equal(packet.can_commit,false); assert.equal(packet.needs_review.length,1);
    await assert.rejects(apply(value.review_hash), /approval_source_requires_review/);
    assert.deepEqual(await query(`SELECT to_jsonb(t) AS row FROM tasks t WHERE id='${OTHER}'`),before);
    assert.equal((await query('SELECT count(*)::integer AS n FROM tasks'))[0].n,1);
    await sql(`DELETE FROM tasks WHERE id='${OTHER}'`);
  });
  await t.test('historical activity, target and assignment drift cannot duplicate or over-allocate', async () => {
    const value = await review();
    const result = await apply(value.review_hash); assert.equal(result.created_tasks,2); assert.equal(result.notifications_sent,0);
    const [original] = await query("SELECT to_jsonb(t) AS row FROM tasks t WHERE due_date='2026-10-04'");
    await sql("UPDATE tasks SET phase='before' WHERE due_date='2026-10-04'");
    assert.equal(JSON.parse((await review()).review_json).can_commit,false);
    await sql("UPDATE tasks SET phase='during' WHERE due_date='2026-10-04'");
    await sql(`UPDATE tasks SET due_date='2026-10-06',dedupe_key='rule-preview:${ORG}:${PLAN}:2026-10-06:content_publication%3Aduring:plan-rules-v1' WHERE id='${original.row.id}'`);
    assert.equal(JSON.parse((await review()).review_json).can_commit,false);
    await sql(`UPDATE tasks SET due_date='2026-11-02',dedupe_key=NULL,metadata='{}',phase='before',source='manual' WHERE id='${original.row.id}'`);
    assert.equal(JSON.parse((await review()).review_json).can_commit,false);
    await sql(`DELETE FROM tasks WHERE id='${original.row.id}'`);
    const missing = await review(); assert.equal(JSON.parse(missing.review_json).can_commit,false);
    await assert.rejects(apply(missing.review_hash), /approval_source_requires_review/);
    await query('INSERT INTO tasks SELECT * FROM jsonb_populate_record(NULL::public.tasks,$1::jsonb)',[JSON.stringify(original.row)]);
    await sql(`UPDATE tasks SET due_date='2026-10-05' WHERE due_date='2026-10-04'`);
    let invalidIdentity = await review();
    assert.equal(JSON.parse(invalidIdentity.review_json).can_commit,false);
    await assert.rejects(apply(invalidIdentity.review_hash), /approval_source_requires_review/);
    await sql(`UPDATE tasks SET due_date='2026-10-04' WHERE dedupe_key LIKE '%2026-10-04:%'`);
    await sql(`UPDATE tasks SET dedupe_key=NULL WHERE due_date='2026-10-04'`);
    invalidIdentity = await review(); assert.equal(JSON.parse(invalidIdentity.review_json).can_commit,false);
    await assert.rejects(apply(invalidIdentity.review_hash), /approval_source_requires_review/);
    await sql(`UPDATE tasks SET dedupe_key='rule-preview:${ORG}:${PLAN}:2026-10-04:content_publication%3Aduring:plan-rules-v1' WHERE due_date='2026-10-04'`);
    await sql(`INSERT INTO tasks(id,organization_id,user_id,assigned_employee_id,title,status,due_date,metadata,source,phase) SELECT '${OTHER}',organization_id,user_id,assigned_employee_id,title,status,due_date,metadata,source,phase FROM tasks WHERE due_date='2026-10-04'`);
    invalidIdentity = await review(); assert.equal(JSON.parse(invalidIdentity.review_json).can_commit,false);
    await assert.rejects(apply(invalidIdentity.review_hash), /approval_source_requires_review/);
    await sql(`DELETE FROM tasks WHERE id='${OTHER}'`);
    await sql(`UPDATE operational_plans SET activity_name='تصميم محتوى' WHERE id='${PLAN}'`);
    let changed = await review(); let packet = JSON.parse(changed.review_json);
    assert.equal(packet.tasks.length,0); assert.equal(packet.preserved_tasks.length,2); assert.equal(packet.can_commit,false);
    await assert.rejects(apply(changed.review_hash), /approval_source_requires_review/);
    assert.equal((await query('SELECT count(*)::integer AS n FROM tasks'))[0].n,2);
    await sql(`UPDATE operational_plans SET activity_name='نشر محتوى' WHERE id='${PLAN}'`);
    await sql(`UPDATE operational_plan_months SET monthly_target=25 WHERE id='${MONTH}'`);
    const otherDates = { ...selection(), task_dates: ['2026-10-06'] };
    changed = await review(otherDates); packet = JSON.parse(changed.review_json);
    assert.equal(packet.tasks.length,1); assert.equal(packet.can_commit,false); assert.equal(packet.needs_review.length,2);
    await assert.rejects(apply(changed.review_hash,otherDates), /approval_source_requires_review/);
    await sql(`UPDATE operational_plan_months SET monthly_target=50 WHERE id='${MONTH}'`);
    const full = { ...selection(), task_dates: workingDates(2026,10) };
    await sql(`INSERT INTO user_roles(user_id,organization_id,role) VALUES('${OTHER}','${ORG}','admin'); INSERT INTO user_organizations(user_id,organization_id,approval_status) VALUES('${OTHER}','${ORG}','approved'); SELECT set_config('request.jwt.claim.sub','${OTHER}',false)`);
    const current = await review(full); assert.equal(JSON.parse(current.review_json).can_commit,true);
    await apply(current.review_hash,full);
    await sql(`SELECT set_config('request.jwt.claim.sub','${USER}',false)`);
    assert.equal((await query("SELECT sum((metadata->>'target')::integer)::integer AS n FROM tasks"))[0].n,50);
    await sql(`UPDATE operational_plan_months SET monthly_target=51 WHERE id='${MONTH}'`);
    const retry = await apply(value.review_hash); assert.equal(retry.status,'already_applied'); assert.equal(retry.created_tasks,0);
    assert.deepEqual(retry.task_ids,result.task_ids);
    assert.equal((await query('SELECT count(*)::integer AS n FROM tasks'))[0].n,workingDates(2026,10).length);
    await assert.rejects(apply(value.review_hash,{ ...selection(), task_dates: ['2026-10-05'] }), /approval_stale_review/);
    await sql(`SELECT set_config('request.jwt.claim.sub','${OTHER}',false)`);
    await assert.rejects(apply(value.review_hash), /approval_stale_review/);
    await sql(`SELECT set_config('request.jwt.claim.sub','${USER}',false)`);
  });
  await db.close();
});
