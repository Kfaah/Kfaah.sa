// Run with PGLITE_MODULE pointing to an isolated installation of @electric-sql/pglite.
// Synthetic data only; never connects to a remote database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const orgA = '00000000-0000-0000-0000-000000000001';
const orgB = '00000000-0000-0000-0000-000000000002';
const employee = '00000000-0000-0000-0000-000000000011';
const other = '00000000-0000-0000-0000-000000000012';
const admin = '00000000-0000-0000-0000-000000000013';
const viewer = '00000000-0000-0000-0000-000000000014';
const pending = '00000000-0000-0000-0000-000000000015';
const absent = '00000000-0000-0000-0000-000000000016';
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TYPE app_role AS ENUM ('admin','hr_manager');
CREATE TABLE organizations(id uuid PRIMARY KEY,is_active boolean);
CREATE TABLE employees(id uuid PRIMARY KEY,organization_id uuid,user_id uuid,full_name text,status text,is_viewer_account boolean);
CREATE TABLE user_organizations(user_id uuid,organization_id uuid,approval_status text,can_write boolean,role text);
CREATE FUNCTION is_super_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION has_role_in_org(u uuid,r app_role,o uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM user_organizations WHERE user_id=u AND organization_id=o AND approval_status='approved' AND role=r::text) $$;
CREATE FUNCTION organization_member_can_write(u uuid,o uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM user_organizations WHERE user_id=u AND organization_id=o AND approval_status='approved' AND can_write) $$;
INSERT INTO organizations VALUES ('${orgA}',true),('${orgB}',true);
`);
for (const [u,o,role,status,write] of [[employee,orgA,'user','approved',true],[other,orgB,'user','approved',true],[admin,orgA,'admin','approved',true],[viewer,orgA,'user','approved',false],[pending,orgA,'user','pending',true],[absent,orgA,'user','approved',true]]) {
  await db.query('INSERT INTO user_organizations VALUES ($1,$2,$3,$4,$5)',[u,o,status,write,role]);
  await db.query("INSERT INTO employees VALUES ($1,$2,$1,$3,'active',$4)",[u,o,u,viewer===u]);
}
await db.exec(await readFile(new URL('../docs/employee-attendance.sql',import.meta.url),'utf8'));
const day = (await db.query("SELECT (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date::text AS day")).rows[0].day;
let passed=0;
async function asUser(u) { await db.exec('RESET ROLE'); await db.query("SELECT set_config('test.user',$1,false)",[u]); await db.exec('SET ROLE authenticated'); }
async function rejects(sql,args=[]) { await assert.rejects(db.query(sql,args)); passed++; }
const record = (action,o=orgA) => db.query('SELECT record_employee_attendance($1,$2)',[o,action]);
const rows = (o=orgA) => db.query('SELECT * FROM get_employee_attendance($1,$2)',[o,day]);
await asUser(employee);
assert.equal((await rows()).rows.length,1); passed++;
assert.equal((await rows()).rows[0].status,'unrecorded'); passed++;
await rejects('SELECT * FROM get_employee_attendance($1,$2)',[orgB,day]);
await rejects('SELECT record_employee_attendance($1,$2)',[orgB,'check_in']);
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_out']);
await record('check_in'); assert.equal((await rows()).rows[0].status,'present'); passed++;
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_in']);
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'absent']);
await record('check_out'); assert.ok((await rows()).rows[0].check_out_at); passed++;
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_out']);
await rejects('SELECT * FROM employee_attendance');
await rejects('DELETE FROM employee_attendance');
await asUser(viewer); await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_in']);
await asUser(pending); await rejects('SELECT * FROM get_employee_attendance($1,$2)',[orgA,day]);
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_in']);
await asUser(absent); await record('absent'); assert.equal((await rows()).rows[0].status,'absent'); passed++;
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_out']);
await asUser(admin);
assert.equal((await db.query('SELECT * FROM get_employee_attendance($1,$2,true)',[orgA,day])).rows[0].employee_id,admin); passed++;
assert.equal((await rows()).rows.length,4); passed++;
await rejects('SELECT * FROM get_employee_attendance($1,$2)',[orgB,day]);
await db.exec('RESET ROLE'); await db.query('UPDATE organizations SET is_active=false WHERE id=$1',[orgA]);
await asUser(employee); await rejects('SELECT * FROM get_employee_attendance($1,$2)',[orgA,day]);
await rejects('SELECT record_employee_attendance($1,$2)',[orgA,'check_in']);
await db.exec('RESET ROLE; SET ROLE anon'); await rejects('SELECT * FROM get_employee_attendance($1,$2)',[orgA,day]);
console.log(`${passed} attendance database checks passed (isolated synthetic PostgreSQL).`);
await db.close();
