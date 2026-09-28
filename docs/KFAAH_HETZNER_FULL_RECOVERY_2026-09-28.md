# Kfaah Hetzner full recovery plan — 2026-09-28

> Scope: restore the Kfaah platform after the Lovable + hosted Supabase cutover so
> the Hetzner deployment is functionally equivalent to the source repository,
> preserves organization isolation/branding/data, and has a tested rollback.
>
> This document does **not** authorize an unreviewed live mutation. The running
> backend is root-owned and must be repaired through a controlled operator change.

## 1. Confirmed findings

The recovery audit has confirmed all of the following:

1. The public frontend builds from this repository and is configured for
   `https://kfaah.sa`.
2. Auth/REST/Storage/Realtime are routed through the self-hosted Supabase gateway
   on port 8000.
3. `/functions/v1/` is **not** routed through the self-hosted Supabase functions
   service. Nginx currently sends it to a separate root-owned Python process:
   `/opt/kfaah/functions/app.py` on port 9001.
4. The Python functions gateway is not contract-equivalent to
   `supabase/functions/*`:
   - active frontend routes are missing (for example marketing/report routes);
   - several routes return synthetic-looking success payloads without the request
     data the original source requires;
   - the original `create-org-viewer-accounts` source requires authenticated
     admin access, while the temporary gateway returned organization data without
     that caller contract during the read-only probe;
   - `setup-demo` reported credentials, but those credentials were rejected by
     the real Auth service immediately afterwards.
5. Nginx is not the cause of small-file upload failures. The current Storage
   route accepts request bodies above 10 MB without returning HTTP 413.
6. There are source-of-truth gaps in storage provisioning. The recovery branch
   now contains an idempotent migration that creates/normalizes
   `org-documents` and `analysis-previews` and tightens branding asset writes.
7. The frontend advertises a 200 MB file limit, while the current Nginx Storage
   location is 64 MB. The self-hosted Storage global `FILE_SIZE_LIMIT` must also
   be verified before claiming 200 MB support.
8. `kfaah-mail-sync` and `kfaah-offsite-backup` were not active in the
   read-only server audit. They require independent restoration/verification.
9. The `kfaah-supabase.service` systemd wrapper reports inactive even though the
   underlying Supabase containers/processes are running. The real ownership and
   restart mechanism must be documented before any service restart.

## 2. Recovery principle

Do not patch the React frontend to mimic missing backend behavior.

The source of truth for business behavior is:

- frontend: `src/**`
- database contract: `supabase/migrations/**` plus reviewed
  `drizzle/migrations/**`
- Edge Functions: `supabase/functions/<function>/index.ts`
- production API origin: `https://kfaah.sa`

The temporary Python gateway may be kept only as a rollback artifact until the
real function runtime passes the contract suite. It must not remain the primary
implementation once source parity is established.

## 3. Mandatory pre-change backup

Before touching Docker Compose, Nginx, database schema, Storage, or functions:

1. Record the exact self-hosted Supabase release/version currently installed.
2. Export the effective Docker Compose files and non-secret configuration.
3. Create an encrypted PostgreSQL logical dump and verify it can be listed.
4. Snapshot the Storage object volume/directory.
5. Save:
   - `/etc/nginx/sites-enabled/kfaah`
   - `/etc/systemd/system/kfaah-functions.service`
   - `/opt/kfaah/functions/app.py`
   - the current production/staging frontend release identifiers.
6. Record SHA-256 hashes of the backup artifacts.
7. Copy the encrypted backup off the Hetzner server and verify the copy.
8. Do not store database dumps, donor data, private keys, tokens, or passwords in
   GitHub.

No destructive schema or service change should begin until the backup exists.

## 4. Read-only inventory before repair

Run `deploy/recovery/read_only_hetzner_audit.sh` as root (or through an
operator-approved root shell). It does not modify the server and does not print
secret values.

The operator must capture:

- active Supabase containers/images and exact versions;
- whether an Edge Runtime/functions container already exists but is stopped;
- the actual Compose project directory;
- the exact functions volume path;
- names (not values) of configured variables in the functions environment;
- Storage global file-size setting presence;
- Nginx routes/body limits;
- current Python gateway hash and systemd unit;
- object volume location/size;
- database container identity;
- mail-sync and offsite-backup service states.

## 5. Restore the real Edge Functions runtime

### 5.1 Version matching

Restore Edge Runtime using the **same self-hosted Supabase release currently
running**, unless a separately tested upgrade is approved.

Do not copy a random latest Compose fragment into production. Auth, Kong,
PostgREST, Storage, Realtime, and Edge Runtime versions must remain compatible.

### 5.2 Function source

Populate the runtime functions volume with the reviewed repository source:

`supabase/functions/<FUNCTION_NAME>/index.ts`

The runtime must expose every function referenced by the frontend, including at
minimum:

- uploads/data: `process-upload`, `analyze-uploaded-file`,
  `parse-staff-duties-xlsx`, `import-org-documents`
- intelligence: `run-intelligence`, `deep-org-analysis`,
  `daily-donor-intelligence`, `analyze-organization`
- planning: `generate-plan-deep`, `generate-plan-from-excel`,
  `generate-executive-plans`
- task/accountability: `evaluate-task-quality`, `verify-evidence`,
  `top-up-employee-tasks`, `smart-task-dispatcher`,
  `generate-related-tasks`
- marketing: `marketing-radar`, `marketing-suggest-campaigns`,
  `marketing-generate-content`, `marketing-evaluate-campaign`,
  `marketing-design-brief`
- reporting: `admin-insights`, `executive-report`,
  `generate-smart-report`, `report-suggestions`, `donor-insights`,
  `suggest-finance-reports`
- organization/account: `org-self-signup`, `create-employee`,
  `delete-employee`, `create-org-viewer-accounts`,
  `impersonate-user`, `discover-org-accounts`
- email/integrations: `send-transactional-email`,
  `fetch-platform-email-replies`, `sync-external-source` and the reviewed
  webhook/queue functions.

The contract audit in
`scripts/recovery/audit_edge_function_auth.py` must be reviewed before choosing
the JWT mode.

### 5.3 Runtime environment

Configure function variables on the server only. Required families include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KFAAH_AI_API_KEY`
- `KFAAH_AI_CHAT_URL`
- `KFAAH_AI_RESPONSES_URL` where used
- `FIRECRAWL_API_KEY` where discovery/scraping is enabled
- `KFAAH_EMAIL_*`
- Zoho mail variables required by the mail functions

Verify presence only in logs. Never echo the values.

### 5.4 Authentication model

This is a hard release gate.

Several source functions use service-role access and rely on Edge Runtime JWT
verification rather than doing a second caller check internally. Therefore:

- never expose the complete source function tree through a permissive gateway;
- privileged functions must either be protected by runtime JWT verification or
  be hardened with an internal caller/role check;
- webhook/public functions with `verify_jwt=false` must have their own
  appropriate secret/signature or tightly constrained public workflow;
- the bulk viewer-account provisioner must be super-admin only. The recovery
  branch already enforces this and replaces the shared default password with a
  unique temporary password.

Before cutover, unauthenticated probes to privileged routes must return
401/403, not generated data or successful mutations.

## 6. Restore Storage contracts

After the database backup is verified, apply the reviewed pending migrations in
order. The recovery migration:

`supabase/migrations/20260928153000_recover_storage_contracts.sql`

ensures:

- private `org-documents` bucket with a 200 MB bucket limit;
- private `analysis-previews` bucket with the expected PNG limit;
- organization-scoped preview reads;
- organization-path-scoped writes to `branding-assets`.

Then verify every bucket referenced by the application exists and has the
correct privacy/policies.

### 6.1 File size consistency

For a true 200 MB UI limit, all three layers must agree:

1. frontend maximum = 200 MB;
2. Nginx `client_max_body_size` for `/storage/v1/` >= 200 MB
   (use a small transport margin, e.g. 220–256 MB);
3. self-hosted Storage `FILE_SIZE_LIMIT` >= 209715200 bytes;
4. the target bucket `file_size_limit` >= the intended maximum.

Until all four match, the frontend must not claim 200 MB.

## 7. Function cutover

Use a canary sequence:

1. Start/recreate the official functions service on an internal test port/path
   without changing public Nginx.
2. Test every route against the original source contract.
3. Verify privileged routes reject anonymous callers.
4. Verify AI calls actually reach the configured AI provider and return
   data-dependent results, not canned responses.
5. Verify Auth-created users are visible to the real Auth service.
6. Verify a test file upload -> storage object -> upload log -> AI analysis ->
   signed preview -> cleanup.
7. Only after all canaries pass, route public
   `/functions/v1/` to the official Supabase API gateway on port 8000.
8. Keep port 9001 stopped-but-recoverable during the first monitored release.
9. Remove/disable the Python gateway only after the rollback window closes.

## 8. Data integrity and Tadabbur recovery

Data recovery is a separate acceptance gate from code deployment.

Locate the exact organization row for:

`جمعية تدبر لتحفيظ القرآن الكريم`

Then compare the restored database against the authoritative pre-cutover
backup/source for at least:

- organization row/slug/status/logo;
- organization profile and branding;
- approved memberships and roles;
- employees and manager relationships;
- departments/job roles;
- operational plans;
- executive plans;
- tasks, assignments, messages/evidence;
- uploaded file logs;
- Storage objects by organization prefix;
- deep analyses and source previews;
- intelligence runs/insights;
- accountability records;
- marketing campaigns/content where applicable;
- donor/donation data where applicable.

For each table/object family record:

- source count;
- restored count;
- missing primary keys;
- rows with wrong `organization_id`;
- orphaned foreign keys;
- newest/oldest timestamps;
- representative checksum/hash where practical.

Never “recreate” missing Tadabbur history from guesses. Restore it from the
authoritative dump/object backup or document it as unrecovered.

## 9. Branding/identity acceptance

For every active organization:

1. login page shows that organization's correct name/logo;
2. internal header/sidebar shows the same identity;
3. primary/secondary/accent colors come from that organization's current
   branding/profile only;
4. switching organizations never leaks the previous organization's cached logo
   or colors;
5. branding image URLs resolve;
6. organization admins can update only their own branding path;
7. platform-admin routes remain neutral unless intentionally embedded.

## 10. End-to-end acceptance matrix

A page rendering is not acceptance. Each feature must complete its business
operation.

Required smoke tests:

| Area | Must prove |
| --- | --- |
| Auth | login/logout/session refresh; org isolation; rejected/pending membership behavior |
| Organizations | correct active org, slug routing, logo/colors |
| Employees | list/create/update/delete; account link; manager relationships |
| Uploads | small doc, spreadsheet, >8 MB fallback, signed preview, delete |
| Import | donations/store/subscription/campaign/gift/abandoned cart import paths |
| AI analysis | file-specific analysis saved to the correct org |
| Intelligence | run completes and writes org-scoped insights/results |
| Plans | AI plan, Excel plan, executive plans persist correctly |
| Tasks | create/assign/update/evidence/quality/related-task flows |
| Reports | executive/admin/donor/finance/report-suggestion flows |
| Marketing | radar/suggest/content/evaluate/design brief |
| Email | transactional send, reply sync, unsubscribe/suppression |
| Branding | upload/logo/color persistence and isolation |
| Backup | backup completes, is copied off-host, and restore drill is documented |
| Tadabbur | historical records/counts/objects match authoritative source |

## 11. Release gate

Do not promote a repaired backend/frontend to live until all of these are true:

- source CI/build/typecheck pass;
- no active frontend Function route returns `Unknown function`;
- privileged Function routes reject unauthenticated requests;
- authenticated Storage upload/preview/delete passes;
- AI responses are real and data-dependent;
- database migrations are at the intended head;
- Storage buckets/policies/limits match the source contract;
- Tadabbur integrity reconciliation is complete;
- branding isolation is verified across multiple organizations;
- mail and backup states are intentionally resolved;
- a tested rollback exists.

## 12. Rollback

If any post-cutover gate fails:

1. restore the prior Nginx functions upstream;
2. stop the new functions runtime if it is the cause;
3. restore schema only from the verified pre-change database backup if a
   migration caused corruption/incompatibility;
4. restore Storage snapshot only if object mutation occurred;
5. restore the prior frontend release if its source contract is incompatible;
6. document the failed gate before retrying.

Do not continue stacking fixes onto an unverified partial deployment.
