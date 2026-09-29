#!/usr/bin/env node
/**
 * Generate a rehearsal-only SQL script for Tadabbur missing public rows.
 *
 * Required:
 *   TADABBUR_RECONCILE_PLAN=/path/tadabbur-reconcile-plan.json
 * Optional:
 *   OUTPUT_SQL=./tadabbur-rehearsal.sql
 *
 * Safety:
 * - refuses when missing Auth users exist;
 * - refuses unresolved FK dependency tables;
 * - includes only missing_public_rows;
 * - uses jsonb_populate_recordset against typed table rows;
 * - ends with ROLLBACK unconditionally.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const planPath = process.env.TADABBUR_RECONCILE_PLAN
  ? path.resolve(process.env.TADABBUR_RECONCILE_PLAN)
  : null;
const outputPath = path.resolve(
  process.env.OUTPUT_SQL || "./tadabbur-rehearsal.sql"
);

function fail(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}
function qident(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    fail("unsafe SQL identifier: " + value);
  }
  return '"' + value + '"';
}
function dollarQuote(jsonText) {
  let n = 0;
  while (true) {
    const tag = "$kfaah_" + crypto
      .createHash("sha256")
      .update(jsonText + ":" + String(n))
      .digest("hex")
      .slice(0, 16) + "$";
    if (!jsonText.includes(tag)) return tag + jsonText + tag;
    n += 1;
  }
}

if (!planPath) fail("TADABBUR_RECONCILE_PLAN is required");
if (!fs.existsSync(planPath)) fail("reconcile plan not found");

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const summary = plan.summary || {};
const policy = plan.policy || {};
const missing = plan.missing_public_rows || {};
const authManual = plan.auth_manual || {};

if (
  summary.organization_id !==
  "00a528ce-e836-4ebd-9a50-35aeaa766501"
) {
  fail("plan is not for Tadabbur");
}

const missingAuth = authManual.missing_users_redacted || [];
if (missingAuth.length) {
  fail(
    "missing Auth users must be reconciled and re-snapshotted before public-row rehearsal"
  );
}

const unresolved =
  policy.unresolved_dependency_tables ||
  summary.unresolved_dependency_tables ||
  [];
if (unresolved.length) {
  fail(
    "unresolved FK dependency tables require manual review: " +
    unresolved.join(",")
  );
}

const restoreOrder =
  policy.restore_order ||
  summary.restore_order ||
  Object.keys(missing).sort();

const sql = [];
sql.push("-- Kfaah Tadabbur missing-only rehearsal");
sql.push("-- Generated: " + new Date().toISOString());
sql.push("-- SAFETY: this script ALWAYS ends in ROLLBACK.");
sql.push("BEGIN;");
sql.push("SET LOCAL statement_timeout = '10min';");
sql.push("SET LOCAL lock_timeout = '5s';");
sql.push("SET LOCAL idle_in_transaction_session_timeout = '12min';");
sql.push("");

let totalRows = 0;
const emittedTables = new Set();

for (const table of restoreOrder) {
  const entries = Array.isArray(missing[table]) ? missing[table] : [];
  if (!entries.length) continue;

  const rows = entries.map((entry) => entry.row);
  totalRows += rows.length;
  emittedTables.add(table);

  const payload = JSON.stringify(rows);
  sql.push("-- table=" + table + " rows=" + rows.length);
  sql.push(
    "INSERT INTO public." + qident(table)
    + " SELECT * FROM jsonb_populate_recordset("
    + "NULL::public." + qident(table) + ", "
    + dollarQuote(payload) + "::jsonb)"
  );
  sql.push("ON CONFLICT DO NOTHING;");
  sql.push("");
}

const leftovers = Object.keys(missing).filter(
  (table) =>
    Array.isArray(missing[table]) &&
    missing[table].length &&
    !emittedTables.has(table)
);
if (leftovers.length) {
  fail("restore order omitted missing tables: " + leftovers.join(","));
}

sql.push("-- Verification only; no changes persist.");
sql.push(
  "SELECT 'TADABBUR_REHEARSAL_ROWS_ATTEMPTED' AS check_name, "
  + String(totalRows) + "::bigint AS value;"
);
sql.push("ROLLBACK;");
sql.push("");

fs.writeFileSync(outputPath, sql.join("\n"), { mode: 0o600 });

console.log("TADABBUR_REHEARSAL_SQL=READY");
console.log("output=" + outputPath);
console.log("rows=" + totalRows);
console.log("tables=" + emittedTables.size);
