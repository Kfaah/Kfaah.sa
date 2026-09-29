#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ORG = "00a528ce-e836-4ebd-9a50-35aeaa766501";
const USER = "11111111-1111-4111-8111-111111111111";
const EMP = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "kfaah-tadabbur-test-"));
const trustedDir = path.join(root, "trusted");
const outDir = path.join(root, "out");
fs.mkdirSync(path.join(trustedDir, "storage", "org-documents", ORG), {
  recursive: true
});
fs.writeFileSync(
  path.join(trustedDir, "storage", "org-documents", ORG, "trusted.txt"),
  "trusted"
);
fs.writeFileSync(
  path.join(trustedDir, "storage", "org-documents", ORG, "existing.txt"),
  "existing"
);

const trusted = {
  tables: {
    organizations: [
      { id: ORG, name: "جمعية تدبر", slug: "tadabbur" }
    ],
    employees: [
      {
        id: EMP,
        user_id: USER,
        organization_id: ORG,
        full_name: "موظف تدبر",
        job_role: "موظف"
      }
    ],
    user_organizations: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        user_id: USER,
        organization_id: ORG,
        approval_status: "approved"
      }
    ],
    profiles: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        user_id: USER,
        first_name: "القديم"
      }
    ],
    user_roles: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        user_id: USER,
        role: "user",
        organization_id: null
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        user_id: USER,
        role: "super_admin",
        organization_id: null
      }
    ],
    tasks: [
      {
        id: TASK,
        organization_id: ORG,
        title: "مهمة قديمة",
        status: "pending"
      }
    ],
    __auth__: [
      {
        users: [{ id: USER, email: "hidden@example.test" }],
        identities: [{ id: "identity-1", user_id: USER, provider: "email" }],
        mfa_factors: []
      }
    ],
    __storage_metadata__: [
      {
        buckets: [{ id: "org-documents" }],
        objects: [
          {
            id: "obj-1",
            bucket_id: "org-documents",
            name: ORG + "/trusted.txt"
          },
          {
            id: "obj-2",
            bucket_id: "org-documents",
            name: ORG + "/existing.txt"
          }
        ]
      }
    ]
  }
};

const current = {
  tables: {
    organizations: [
      { id: ORG, name: "جمعية تدبر", slug: "tadabbur" }
    ],
    employees: [
      {
        id: EMP,
        user_id: USER,
        organization_id: ORG,
        full_name: "موظف تدبر",
        job_role: "موظف"
      }
    ],
    user_organizations: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        user_id: USER,
        organization_id: ORG,
        approval_status: "approved"
      }
    ],
    profiles: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        user_id: USER,
        first_name: "الأحدث"
      }
    ],
    user_roles: [],
    tasks: [],
    __auth__: [
      {
        users: [{ id: USER }],
        identities: [],
        mfa_factors: []
      }
    ],
    __storage_metadata__: [
      {
        buckets: [{ id: "org-documents" }],
        objects: [
          {
            id: "current-obj",
            bucket_id: "org-documents",
            name: ORG + "/existing.txt"
          }
        ]
      }
    ]
  }
};

const trustedJson = path.join(trustedDir, "database.json");
const currentJson = path.join(root, "current.json");
fs.writeFileSync(trustedJson, JSON.stringify(trusted));
fs.writeFileSync(currentJson, JSON.stringify(current));

const planner = path.resolve(
  "scripts/recovery/plan-tadabbur-reconcile.mjs"
);
const run = spawnSync(process.execPath, [planner], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    TRUSTED_RESTORE_DIR: trustedDir,
    CURRENT_DATABASE_JSON: currentJson,
    OUTPUT_DIR: outDir
  },
  encoding: "utf8"
});

if (run.status !== 0) {
  console.error(run.stdout);
  console.error(run.stderr);
  process.exit(run.status || 1);
}

const plan = JSON.parse(
  fs.readFileSync(path.join(outDir, "tadabbur-reconcile-plan.json"), "utf8")
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  plan.missing_public_rows.tasks &&
    plan.missing_public_rows.tasks.some((x) => x.row.id === TASK),
  "missing Tadabbur task was not planned"
);
assert(
  plan.conflicts.profiles &&
    plan.conflicts.profiles.some(
      (x) =>
        x.current.first_name === "الأحدث" &&
        x.resolution === "preserve_current_manual_review"
    ),
  "current profile conflict was not preserved"
);
assert(
  plan.auth_manual.super_admin_roles.length === 1,
  "super_admin role was not isolated for manual review"
);
assert(
  !JSON.stringify(plan.missing_public_rows).includes('"role":"super_admin"'),
  "super_admin role leaked into automatic missing-only plan"
);
assert(
  plan.storage.missing.some((x) => x.name === ORG + "/trusted.txt"),
  "missing storage object was not planned"
);
assert(
  plan.storage.existing_preserved.some(
    (x) => x.name === ORG + "/existing.txt"
  ),
  "existing storage object was not preserved"
);
assert(
  plan.auth_manual.missing_users_redacted.length === 0,
  "existing auth user should not be planned as missing"
);

console.log("TADABBUR_RECONCILE_SELF_TEST=PASS");
fs.rmSync(root, { recursive: true, force: true });
