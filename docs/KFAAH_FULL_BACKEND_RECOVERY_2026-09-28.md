# Kfaah full backend recovery — 2026-09-28

## Confirmed production findings

1. The frontend source builds successfully against `https://kfaah.sa`.
2. The live Hetzner Supabase stack is reachable through Auth, REST and Storage.
3. Native self-hosted Supabase Edge Runtime exists on port 8000:
   - `/functions/v1/hello` has a real entrypoint.
   - Kfaah functions such as `generate-plan-deep` currently have no native entrypoint.
4. Public `/functions/v1/` is still routed through a separate Python compatibility gateway on port 9001.
5. That Python gateway is not behaviorally equivalent to the original Edge Functions:
   - some functions return synthetic success responses;
   - some production functions return unknown-function errors;
   - `setup-demo` returns credentials that Auth rejects.
6. The live database schema is incomplete:
   - expected tables from generated types: 105;
   - missing live tables detected: 55;
   - existing tables also have legacy/missing columns.
7. Critical Storage buckets are present on live Hetzner, including:
   `data-uploads`, `org-documents`, `staff-duties-files`,
   `branding-assets`, `analysis-previews`, `action-plan-files`,
   `task-attachments`, and `ai-plan-references`.
8. Tadabbur identity is present and correctly scoped:
   - id: `00a528ce-e836-4ebd-9a50-35aeaa766501`
   - slug: `tadabbur`
   - name: `جمعية تدبر لتحفيظ القرآن الكريم بمركز الحميراء`
   - logo host: `kfaah.sa`

## Recovery principle

Do not keep extending the Python compatibility gateway. Restore the original
`supabase/functions` source into the native self-hosted Edge Runtime and restore
the database schema from source-controlled migrations.

Supabase's self-hosted layout expects user functions under:

`volumes/functions/<function-name>/index.ts`

Keep the built-in `main` and `hello` directories in place.

## Stage 0 — freeze and backup

Before modifying schema or backend routing:

- Preserve the current frontend release.
- Create a fresh PostgreSQL custom-format dump.
- Preserve the current Supabase `volumes/functions` directory.
- Preserve Nginx configuration.
- Preserve current Storage data.
- Do not delete or reset the production database.

The private backup repository contains a successful pre-migration secure backup
from 2026-09-08 with:
- 105 tables
- 3,534 rows
- 189 storage files
- 0 errors

Its RSA public-key fingerprint is:
`fa7e02da0a4f6c41da30383b3af1861f67168a0f1548ad6c4eb4495c78496570`.

The private key currently found in the old deploy workspace has a different
fingerprint and must NOT be used to decrypt that backup. Locate the matching
private key from the approved offline secret store before attempting data recovery.

## Stage 1 — database migration history audit

Run from an authorized root/admin shell inside the self-hosted Supabase directory.

1. Inspect `supabase_migrations.schema_migrations`.
2. Compare it to `supabase/migrations/*.sql` from this repository.
3. Run a dry migration comparison before changing production.
4. If a migration is recorded as applied but its objects are absent, mark only
   that migration as reverted in migration history after confirming the mismatch.
5. Never use `db reset` against production.

The recovery must use migration history, not ad-hoc table creation, wherever possible.

## Stage 2 — restore missing schema

The current live schema audit reports these missing functional areas:

- accountability/evidence
- action plans and related tasks
- conversations/internal messages
- employee files/intelligence/evaluations
- finance/expenses/allocations
- initiatives/sub-initiatives and department mappings
- marketing campaigns/channels/assets/metrics/playbook/seasons
- platform email state/suppression/unsubscribe logs
- external insights
- subscriptions
- task-generation/task-quality/time-baseline tables
- welcome backgrounds

It also reports legacy columns missing from:
`abandoned_carts`, `bank_transfers`, `failed_donations`,
`data_uploads_log`, `deep_analyses`, `smart_report_suggestions`,
and `staff_duties_imports`.

After applying migrations, rerun the schema-diff audit. Recovery is not accepted
until the expected schema produces zero missing tables and zero missing expected columns.

## Stage 3 — deploy original Edge Functions

1. Copy repository `supabase/functions/*` into the self-hosted
   `volumes/functions/` directory.
2. Preserve the built-in `main` and `hello` directories.
3. Configure custom function environment variables through `.env.functions`
   or the Compose `functions.environment` section. Do not print their values.
4. Recreate/restart only the `functions` service.
5. Test the native port 8000 path first.
6. Only after native tests pass, change Nginx `/functions/v1/` upstream from
   port 9001 to port 8000.
7. Keep the Python gateway available for rollback until acceptance is complete.

Required custom variables referenced by source include, depending on enabled features:
`KFAAH_AI_API_KEY`, `KFAAH_AI_CHAT_URL`, `KFAAH_AI_RESPONSES_URL`,
`FIRECRAWL_API_KEY`, email provider variables, and mailbox variables.

## Stage 4 — functional acceptance tests

A page rendering is not sufficient. Test real effects with an approved test user
and test organization, then remove test data.

Minimum matrix:

- Auth login/logout/session refresh
- organization switching and isolation
- organization branding/logo/colors
- `org-documents` upload, signed preview, delete
- `staff-duties-files` upload and parse
- `ai-plan-references` upload and plan generation
- uploaded-file AI analysis persistence
- deep organization analysis persistence
- intelligence run persistence
- operational plan generation
- executive plan generation
- related task generation
- task quality/evidence workflows
- finance AI/report suggestions
- marketing radar/campaign suggestion/content/evaluation
- internal messages and attachments
- transactional email
- mailbox reply synchronization
- backup job

## Stage 5 — Tadabbur recovery validation

For organization `00a528ce-e836-4ebd-9a50-35aeaa766501`, compare current/live
counts and records against the last trustworthy pre-migration backup before
inserting any recovered rows.

Validate at minimum:
- employees
- tasks
- operational plans
- executive plans
- upload history
- deep analyses
- intelligence outputs
- smart tasks
- marketing ideas/campaigns
- accountability/evidence records
- stored files

Use upsert/import rules based on stable primary keys. Never bulk-delete current
Tadabbur records to make a backup fit.

## Stage 6 — cutover and rollback

Cut over only after all acceptance tests pass.

Rollback must be possible by:
- restoring the saved Nginx config;
- restoring the previous functions volume;
- restoring the pre-recovery database dump if a schema migration caused damage;
- restoring the previous frontend release independently.

The Python gateway should be disabled only after the native Edge Runtime has
passed the complete function matrix.
