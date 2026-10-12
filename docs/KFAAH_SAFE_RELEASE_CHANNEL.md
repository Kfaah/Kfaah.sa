# Kfaah release channel — review draft, NOT activated

Target: `Kfaah/Kfaah.sa`. GitHub owner/actor: `Kfaah`, ID `341028123` (confirmed through GitHub API). This change prepares the copied repository; it does not alter the original repository or production. Attendance implementation remains in its separate branch and this PR does not include its SQL.

## What changed

- Owner/repository checks in PREPARE/VERIFY/STAGE/PUBLISH are bound to the new repository and numeric identity. Event origin, OWNER association, exact title and JSON fields, duplicate-field rejection, immutable workflow SHA and first-attempt checks remain.
- 28 legacy workflows moved to `docs/legacy-workflows/`. This preserves history while removing old automatic publishers, manager automation, backup jobs and broken workflows from GitHub's active workflow directory. Do not copy them back merely to clear an error.
- The maintained Actions are frontend validation, release safety checks, PREPARE/VERIFY, readonly baseline, STAGE and PUBLISH. No new push-to-production trigger exists. GitHub Actions dependencies use full commit SHAs checked against the official actions repositories.
- Server jobs in readonly baseline, STAGE and PUBLISH have a literal false condition. STAGE/PUBLISH Python controllers also have `EXECUTION_ENABLED=False`; no repository variable or issue field unlocks them. Separate reviewed code changes are needed for activation.
- `channel-approval.json` deliberately has null release bindings. No old baseline, old workflow run/artifact ID, or fabricated current release is treated as fresh evidence. STAGE/PUBLISH reject missing bindings.
- Baseline expectation is read from the reviewed approval file and validated before passing a restricted release path as data to SSH. Remote code, metadata/byte stability checks, helper fingerprint checks, SSH strict host verification, Acorn integrity and build/stage provenance remain.
- Publisher activity must be checked in BOTH the new repository and `gaberalhrese-cloud/shop-soulmate-04`. Failure to read the original repository blocks the channel. This does not establish that every external/root writer is excluded.
- `deploy/install-frontend-dependencies.py` installs via a temporary lockfile with five obsolete mirror URLs replaced by official npm URLs; package versions and integrity hashes are unchanged. It leaves tracked package/lock files untouched and preserves unknown existing node_modules. Only its own generated links can be refreshed. The build script uses this installer.

## Current evidence

- 20 synthetic offline release security tests passed: `python3 -B scripts/recovery/test-release-channel.py`.
- 12 prepared-release tests and existing worker/promotion safety checks passed.
- All six active workflow files passed official actionlint 1.7.12 (shellcheck and pyflakes integrations unavailable; these were not run). The downloaded actionlint archive was checked against the official release SHA256 checksum file.
- Frozen install + production-mode Vite build + bundle independence checks ran successfully twice from an isolated copy, using `ci-public-placeholder`, NOT a production key. Original manifests/lock remained unchanged. Local Node 24.19.0 was used. GitHub Actions subsequently passed both the new safety job and the full frontend build job using Node 22 on draft PR #1 (runs 38262583472 and 38262583601).
- GitHub environments list is empty. Integration receives HTTP 403 for Actions permission settings and secret metadata. This is insufficient integration scope, not proof that secrets are absent.
- Six historical failed workflow records on the attendance branch were visible for legacy YAML files. They predate this branch; no production operation was invoked by this preparation.
- No SSH/remote audit, build artifact prepared by Actions, STAGE, PUBLISH, rollback or database operation was executed. No authentication credential or GitHub setting was created/changed. This draft is not release readiness.

## Required secure configuration (after review)

Do not paste values in chat or commit them. The owner/admin checks existing GitHub settings before adding requirements. Reuse authorized bindings where available.

| Requirement | Purpose | Boundary |
| --- | --- | --- |
| `VITE_SUPABASE_ANON_KEY` | Real frontend PREPARE build; mapped to `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key only; never service role |
| `HETZNER_HOST` | Actual kfaah.sa server | Confirm existing approved host; do not use another project's server |
| `HETZNER_USER` | Existing bounded deploy account | Must be `deploy` |
| `HETZNER_SSH_KEY` | Authorized deployment authentication | Existing restricted key preferred; no new root/admin account required |
| `HETZNER_KNOWN_HOSTS` | Pinned SSH host identity | Confirm out-of-band; strict verification stays enabled |
| `KFAAH_LEGACY_READ_TOKEN` | Read Actions activity in original private repository | Minimum read-only Actions/metadata scope to original repo; no push/admin/server permission |

Create/review protected GitHub environments `kfaah-readonly`, `kfaah-stage` and `kfaah-production` before activation. Restrict deployment branches to main and configure production approval by the owner/reviewer. Merely adding an environment name to YAML does NOT configure protection. GitHub plan support and actual protection rules must be checked. Environment-scoped server secrets are preferred. None of these settings has been changed.

Do not enable legacy publishing or submit production-triggering issues before the archival/security PR is reviewed and merged into main. Read-only CI jobs ran on PR #1; Actions configuration settings are not readable by this integration and were not changed. The old main tree still contains legacy workflows. This draft PR alone does not replace it. Do not merge this PR or enable Actions under the assumption that production is ready; hard locks remain after merge.

## Activation sequence requiring separate review

1. Review this PR and its passed Node 22 CI. Merge only after owner's review. Verify protections, authentication and known-hosts metadata through supported settings.
2. Owner/server admin confirms actual current release target via authorized read-only access. Review the readonly job's scope and fill `expected_current` with that verified path. Only then unlock readonly baseline in a separate reviewed change; validate new manifests/helper identities and publisher state, never reuse October 9 evidence.
3. Run PREPARE and VERIFY for an explicitly reviewed source SHA on main, with a real public frontend key, and retain sealed artifact/run/source/checksum evidence. Requests are new OWNER issues with exact validator schemas; old runs and reruns are rejected.
4. Fill `build_tools_commit`, `audit_tools_commit`, `baseline_manifest_sha256` from freshly verified evidence; update audit and tool hashes only when reviewed source really changes. Stage tools checkouts use immutable event SHA and exact byte hashes; any future use of differing tool commits must keep checkout references and the hash gates consistent.
5. Review/unlock STAGE in BOTH workflow and Python controller, after prerequisites and quiet-window evidence. Confirm baseline backup and staging bytes; current must remain unchanged. STAGE writes server paths and therefore requires approval, even though it does not publish live.
6. Record the successful STAGE workflow commit in `stage_tools_commit`, its actual run/artifact IDs and exact evidence byte hashes. Review/unlock PUBLISH in BOTH gates only for the same sealed candidate, after explicit live authorization and recovery review. No rebuild/restage between approved STAGE and PUBLISH.
7. Verify current pointer, HTTPS assets and the changed application functionality. Keep evidence and recovery paths. Existing tooling does not guarantee crash-proof/forced rollback; server administrator-assisted recovery may be needed.

Database schema activation is outside this frontend channel. Attendance needs independent review, isolated backend tests and explicit SQL authorization. Do not publish an attendance UI as functional before backend readiness is proven.
