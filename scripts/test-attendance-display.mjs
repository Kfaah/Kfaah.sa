import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = (await readFile(new URL('../src/lib/attendance.ts',import.meta.url),'utf8'))
  .replace('import { supabase } from "@/integrations/supabase/client";', 'const supabase = {};');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const { riyadhDay, attendanceTime, attendanceLabel } = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(riyadhDay(new Date('2026-10-11T20:59:59Z')),'2026-10-11');
assert.equal(riyadhDay(new Date('2026-10-11T21:00:00Z')),'2026-10-12');
assert.equal(riyadhDay(new Date('2026-12-31T21:00:00Z')),'2027-01-01');
assert.equal(attendanceTime(null),'—');
assert.equal(attendanceLabel({status:'unrecorded',check_out_at:null}),'لم يسجل');
assert.equal(attendanceLabel({status:'absent',check_out_at:null}),'غائب');
assert.equal(attendanceLabel({status:'present',check_out_at:null}),'حاضر');
assert.equal(attendanceLabel({status:'present',check_out_at:'2026-10-11T14:00:00Z'}),'حاضر — انصرف');
console.log('8 attendance display and Riyadh date boundary checks passed.');
