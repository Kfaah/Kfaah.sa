# Employee attendance (not activated)

Request: `.kfaah/requests/employee-attendance.md`.

Employees now contains an organization-scoped daily attendance panel for platform administrators, organization administrators and HR managers. The employee home page and Profile contain self-service check-in, absence and check-out. Preview accounts cannot submit records. Missing records mean “unrecorded”, not absence; no assumptions about working days, holidays or leave are made. Absence is an explicit employee declaration. One record per employee per Riyadh calendar day; repeated registration is rejected. Check-out must follow check-in on the same calendar day. Overnight shifts and correcting a recorded absence are not supported yet.

`employee-attendance.sql` is a **review-only proposal**, not an executed migration. It creates new objects and does not modify existing policies or data. Direct table access is denied; RPCs verify authenticated identity, active organization, approved membership and organization roles. Registration resolves the employee from the authenticated identity, uses server timestamps and denies viewer/inactive employees. Read access is restricted to the caller's employee or authorized managers within the requested organization.

Before activation: verify the existing `organization_member_can_write`, `is_super_admin`, `has_role_in_org`, employee and membership schema against the actual backend. Review/apply the proposal only with separate database authorization. Test on an isolated database with synthetic data: anonymous/pending/viewer denial, cross-organization access, spoofed employee identity, inactive organization/employee, duplicate and concurrent check-in, check-out before/after check-in, repeated check-out, day rollover and errors. Do not run these tests against production. No production credentials are needed for local frontend builds.

GitHub Actions stays disabled in the copied repository. Do not deploy this feature until the backend has been independently validated and release approval is obtained.

## Local validation

- Vite production build using the public CI placeholder (no production authentication).
- TypeScript check and ESLint on the new TypeScript files.
- 8 date/display checks: `node scripts/test-attendance-display.mjs`.
- 23 SQL integration checks using PGlite 0.3.14 and synthetic fixtures. Install the test dependency outside the checkout and run `PGLITE_MODULE=/tmp/kfaah-attendance-sql-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-employee-attendance.mjs`. Existing role helper functions are represented by fixture implementations; this does not validate production policies.
- Existing prepared-release (12 tests), worker safety and promotion safety checks.
- Production bundle independence check.

Validated with Node 24.19.0; the repository documents Node 22. No live login, employee submission, production database test or deployment was performed. Browser interaction and compatibility with the actual backend remain unverified.

The repository lockfile contains five obsolete private mirror download URLs. Local dependencies were installed in `/tmp/kfaah-attendance-deps` using official npm URLs for these exact artifacts while retaining their original integrity checksums, then linked as ignored `node_modules`. The tracked package manifest and lockfile were not changed.
