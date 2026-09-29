#!/usr/bin/env node
/**
 * Read-only Tadabbur reconciliation planner.
 * Never connects to production and never performs INSERT/UPDATE/DELETE.
 *
 * Required:
 *   TRUSTED_RESTORE_DIR=/path/to/decrypted-restore
 * Optional:
 *   CURRENT_DATABASE_JSON=/path/to/current-database.json
 *   OUTPUT_DIR=./tadabbur-reconcile-out
 *   ORGANIZATION_ID=<uuid>
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ORG_ID = process.env.ORGANIZATION_ID ||
  "00a528ce-e836-4ebd-9a50-35aeaa766501";
const trustedDir = process.env.TRUSTED_RESTORE_DIR
  ? path.resolve(process.env.TRUSTED_RESTORE_DIR) : null;
const currentPath = process.env.CURRENT_DATABASE_JSON
  ? path.resolve(process.env.CURRENT_DATABASE_JSON) : null;
const outDir = path.resolve(
  process.env.OUTPUT_DIR || "./tadabbur-reconcile-out"
);

function fail(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}
function info(message) {
  console.log("INFO: " + message);
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function canon(value) {
  return JSON.stringify(canonical(value));
}
function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

if (!trustedDir) fail("TRUSTED_RESTORE_DIR is required");
const trustedDbPath = path.join(trustedDir, "database.json");
if (!fs.existsSync(trustedDbPath)) fail("trusted database.json not found");

const trusted = readJson(trustedDbPath);
if (!trusted || typeof trusted.tables !== "object") {
  fail("trusted database.json has no tables object");
}

let current = { tables: {} };
if (currentPath) {
  if (!fs.existsSync(currentPath)) fail("CURRENT_DATABASE_JSON not found");
  current = readJson(currentPath);
  if (!current || typeof current.tables !== "object") {
    fail("current snapshot has no tables object");
  }
}

fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
const tables = trusted.tables;
const currentTables = current.tables || {};
const selected = new Map();
const selectedIds = new Set();
const memberUserIds = new Set();

function rows(table) {
  return Array.isArray(tables[table]) ? tables[table] : [];
}
function fingerprint(row) {
  return row && row.id != null
    ? "id:" + String(row.id)
    : "json:" + digest(canon(row));
}
function add(table, row, reason) {
  if (!row || typeof row !== "object") return false;
  if (!selected.has(table)) selected.set(table, new Map());
  const bucket = selected.get(table);
  const fp = fingerprint(row);
  if (bucket.has(fp)) {
    const reasons = bucket.get(fp).reasons;
    if (!reasons.includes(reason)) reasons.push(reason);
    return false;
  }
  bucket.set(fp, { row, reasons: [reason] });
  if (isUuid(row.id)) selectedIds.add(row.id);
  return true;
}

for (const row of rows("organizations")) {
  if (row.id === ORG_ID) add("organizations", row, "organization_root");
}
if (!selected.get("organizations") || selected.get("organizations").size !== 1) {
  fail("trusted backup does not contain the Tadabbur organization row");
}

for (const [table, list] of Object.entries(tables)) {
  if (table.startsWith("__") || !Array.isArray(list)) continue;
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    if (row.organization_id === ORG_ID || row.org_id === ORG_ID) {
      add(table, row, "direct_organization_scope");
    }
  }
}

for (const row of rows("user_organizations")) {
  if (row.organization_id === ORG_ID && isUuid(row.user_id)) {
    memberUserIds.add(row.user_id);
  }
}
for (const row of rows("employees")) {
  if (row.organization_id === ORG_ID && isUuid(row.user_id)) {
    memberUserIds.add(row.user_id);
  }
}

for (const row of rows("profiles")) {
  if (memberUserIds.has(row.user_id)) add("profiles", row, "member_profile");
}
for (const row of rows("user_roles")) {
  if (!memberUserIds.has(row.user_id)) continue;
  if (row.role === "super_admin") continue;
  if (row.organization_id && row.organization_id !== ORG_ID) continue;
  add("user_roles", row, "member_role");
}

/* Pull dependent public rows whose UUID foreign-key-like fields point to
 * already selected rows. Rows explicitly scoped to another organization are
 * always excluded.
 */
let changed = true;
let rounds = 0;
while (changed && rounds < 20) {
  changed = false;
  rounds += 1;
  for (const [table, list] of Object.entries(tables)) {
    if (table.startsWith("__") || !Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      if (row.organization_id && row.organization_id !== ORG_ID) continue;
      if (row.org_id && row.org_id !== ORG_ID) continue;

      const refFields = [];
      for (const [key, value] of Object.entries(row)) {
        if (key !== "id" && key.endsWith("_id") &&
            isUuid(value) && selectedIds.has(value)) {
          refFields.push(key);
        }
      }
      if (!refFields.length) continue;
      if (add(table, row, "fk_closure:" + refFields.join(","))) changed = true;
    }
  }
}

const authRaw = Array.isArray(tables.__auth__) ? tables.__auth__[0] : {};
const auth = authRaw && typeof authRaw === "object" ? authRaw : {};
const authSelected = {
  users: (Array.isArray(auth.users) ? auth.users : [])
    .filter((r) => memberUserIds.has(r && r.id)),
  identities: (Array.isArray(auth.identities) ? auth.identities : [])
    .filter((r) => memberUserIds.has(r && r.user_id)),
  mfa_factors: (Array.isArray(auth.mfa_factors) ? auth.mfa_factors : [])
    .filter((r) => memberUserIds.has(r && r.user_id)),
};

const superAdminReview = rows("user_roles")
  .filter((r) => memberUserIds.has(r && r.user_id) && r.role === "super_admin")
  .map((r) => ({
    user_id: r.user_id,
    role: r.role,
    reason: "never_restore_super_admin_automatically"
  }));

const COMPOSITES = {
  user_organizations: ["user_id", "organization_id"],
  user_roles: ["user_id", "role"],
  role_permissions: ["organization_id", "role", "module"],
  organization_profiles: ["organization_id"],
  organization_branding: ["organization_id"],
  organization_settings: ["organization_id"],
  profiles: ["user_id"]
};

function stableKey(table, row) {
  if (row && row.id != null) return "id:" + String(row.id);
  const fields = COMPOSITES[table];
  if (fields && fields.every((f) => row && row[f] !== undefined)) {
    return "composite:" + fields.map((f) => f + "=" + String(row[f] ?? "")).join("|");
  }
  return null;
}

const missing = {};
const equal = {};
const conflicts = {};
const unkeyed = {};

for (const [table, bucket] of selected.entries()) {
  const currentRows = Array.isArray(currentTables[table]) ? currentTables[table] : [];
  const currentByKey = new Map();
  for (const row of currentRows) {
    const key = stableKey(table, row);
    if (key) currentByKey.set(key, row);
  }

  for (const item of bucket.values()) {
    const row = item.row;
    const key = stableKey(table, row);

    if (!key) {
      const exact = currentRows.some((x) => canon(x) === canon(row));
      const target = exact ? equal : unkeyed;
      if (!target[table]) target[table] = [];
      target[table].push({
        key: null,
        row,
        reasons: item.reasons,
        resolution: exact ? "already_present" : "manual_review_no_stable_key"
      });
      continue;
    }

    const existing = currentByKey.get(key);
    if (!existing) {
      if (!missing[table]) missing[table] = [];
      missing[table].push({ key, row, reasons: item.reasons });
    } else if (canon(existing) === canon(row)) {
      if (!equal[table]) equal[table] = [];
      equal[table].push({ key, row, reasons: item.reasons });
    } else {
      if (!conflicts[table]) conflicts[table] = [];
      conflicts[table].push({
        key,
        trusted: row,
        current: existing,
        reasons: item.reasons,
        resolution: "preserve_current_manual_review"
      });
    }
  }
}

/* Storage selection:
 * - path contains organization UUID, or
 * - exact path is referenced by a selected row.
 */
const referencedPaths = new Set();
function inspect(value, field) {
  if (typeof value === "string") {
    if (/(file_path|storage_path|screenshot_path|attachment_path)$/i.test(field || "")) {
      referencedPaths.add(value.replace(/^\/+/, ""));
    }
    if (value.includes("/storage/v1/object/")) {
      const tail = value.split("/storage/v1/object/")[1] || "";
      const parts = tail.split("/").filter(Boolean);
      if (["public", "authenticated", "sign"].includes(parts[0])) parts.shift();
      if (parts.length >= 2) {
        parts.shift();
        referencedPaths.add(parts.join("/").split("?")[0]);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) inspect(item, field);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) inspect(item, key);
  }
}
for (const bucket of selected.values()) {
  for (const item of bucket.values()) inspect(item.row, "");
}

const storageRaw = Array.isArray(tables.__storage_metadata__)
  ? tables.__storage_metadata__[0] : {};
const trustedObjects = Array.isArray(storageRaw && storageRaw.objects)
  ? storageRaw.objects : [];

const currentStorageRaw = Array.isArray(currentTables.__storage_metadata__)
  ? currentTables.__storage_metadata__[0] : {};
const currentObjects = Array.isArray(currentStorageRaw && currentStorageRaw.objects)
  ? currentStorageRaw.objects : [];
const currentStorageKeys = new Set(
  currentObjects.map((o) => String(o.bucket_id || "") + "/" + String(o.name || ""))
);

const selectedStorage = [];
const missingStorage = [];
const existingStorage = [];
const missingExtractedFiles = [];

for (const obj of trustedObjects) {
  const bucket = String(obj && obj.bucket_id || "");
  const name = String(obj && obj.name || "");
  if (!bucket || !name) continue;
  const belongs = name.includes(ORG_ID) || referencedPaths.has(name);
  if (!belongs) continue;

  const item = {
    bucket_id: bucket,
    name,
    metadata: obj.metadata ?? null,
    relative_file: path.posix.join("storage", bucket, name)
  };
  selectedStorage.push(item);

  const key = bucket + "/" + name;
  if (currentStorageKeys.has(key)) {
    existingStorage.push(item);
  } else {
    missingStorage.push(item);
    const local = path.join(trustedDir, "storage", bucket, ...name.split("/"));
    if (!fs.existsSync(local) || !fs.statSync(local).isFile()) {
      missingExtractedFiles.push({ bucket_id: bucket, name, expected_local_path: local });
    }
  }
}

const currentAuthRaw = Array.isArray(currentTables.__auth__)
  ? currentTables.__auth__[0] : {};
const currentAuth = currentAuthRaw && typeof currentAuthRaw === "object"
  ? currentAuthRaw : {};
const currentAuthUserIds = new Set(
  (Array.isArray(currentAuth.users) ? currentAuth.users : [])
    .map((r) => r && r.id).filter(Boolean)
);
const missingAuthUsers = authSelected.users
  .filter((r) => !currentAuthUserIds.has(r && r.id));

function countSection(section) {
  return Object.values(section).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0
  );
}
function redactAuth(list) {
  return list.map((r) => ({
    id: r && r.id || null,
    user_id: r && r.user_id || null,
    provider: r && r.provider || null,
    created_at: r && r.created_at || null
  }));
}

const organizationItem = selected.get("organizations").values().next().value;
const summary = {
  tool: "plan-tadabbur-reconcile",
  generated_at: new Date().toISOString(),
  organization_id: ORG_ID,
  organization_name: organizationItem.row.name || null,
  current_snapshot_supplied: Boolean(currentPath),
  selected_tables: selected.size,
  selected_public_rows: Array.from(selected.values())
    .reduce((sum, bucket) => sum + bucket.size, 0),
  member_users: memberUserIds.size,
  missing_public_rows: countSection(missing),
  exact_existing_public_rows: countSection(equal),
  conflicting_public_rows: countSection(conflicts),
  unkeyed_manual_rows: countSection(unkeyed),
  trusted_auth_users: authSelected.users.length,
  missing_auth_users_manual_only: missingAuthUsers.length,
  super_admin_rows_manual_only: superAdminReview.length,
  selected_storage_objects: selectedStorage.length,
  missing_storage_objects: missingStorage.length,
  existing_storage_objects_preserved: existingStorage.length,
  missing_extracted_storage_files: missingExtractedFiles.length
};

const selectedPublic = {};
for (const [table, bucket] of selected.entries()) {
  selectedPublic[table] = Array.from(bucket.values());
}

const planDoc = {
  summary,
  policy: {
    public_rows: "insert_missing_only",
    existing_different_rows: "preserve_current_manual_review",
    unkeyed_rows: "manual_review",
    auth_rows: "manual_restore_only",
    super_admin_roles: "never_automatic",
    storage: "copy_only_if_bucket_path_absent",
    destructive_operations: "forbidden"
  },
  missing_public_rows: missing,
  conflicts,
  unkeyed_manual_rows: unkeyed,
  auth_manual: {
    missing_users_redacted: redactAuth(missingAuthUsers),
    identities_redacted: redactAuth(authSelected.identities),
    mfa_factors_redacted: redactAuth(authSelected.mfa_factors),
    super_admin_roles: superAdminReview
  },
  storage: {
    missing: missingStorage,
    existing_preserved: existingStorage,
    missing_local_files: missingExtractedFiles
  }
};

fs.writeFileSync(
  path.join(outDir, "tadabbur-reconcile-summary.json"),
  JSON.stringify(summary, null, 2),
  { mode: 0o600 }
);
fs.writeFileSync(
  path.join(outDir, "tadabbur-reconcile-plan.json"),
  JSON.stringify(planDoc, null, 2),
  { mode: 0o600 }
);
fs.writeFileSync(
  path.join(outDir, "tadabbur-trusted-scope.json"),
  JSON.stringify({
    organization_id: ORG_ID,
    public_tables: selectedPublic,
    auth_redacted: {
      users: redactAuth(authSelected.users),
      identities: redactAuth(authSelected.identities),
      mfa_factors: redactAuth(authSelected.mfa_factors)
    },
    storage_objects: selectedStorage
  }, null, 2),
  { mode: 0o600 }
);

info("organization=" + (summary.organization_name || ORG_ID));
info("selected_public_rows=" + summary.selected_public_rows);
info("missing_public_rows=" + summary.missing_public_rows);
info("conflicts_preserved=" + summary.conflicting_public_rows);
info("missing_storage_objects=" + summary.missing_storage_objects);
info("missing_auth_users_manual_only=" + summary.missing_auth_users_manual_only);

if (missingExtractedFiles.length) {
  console.error("ERROR: decrypted storage tree is missing planned objects");
  process.exit(2);
}

console.log("TADABBUR_RECONCILE_PLAN=READY");
