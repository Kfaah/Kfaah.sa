# Kfaah frontend source and staging upload

The original React/TypeScript source is in this repository. The running
`/var/www/kfaah` frontend is an earlier Vite build. The live server's
`kfaah-functions` implementation is separate from the original
`supabase/functions` source and requires its own review.

## Build

The tracked `.env` with the former hosted project was removed. The manual
workflow sets `VITE_SUPABASE_URL=https://kfaah.sa` and reads the *public*
anonymous/publishable key from the `VITE_SUPABASE_ANON_KEY` GitHub Actions
secret. Do not use a service-role key in a `VITE_` variable. Vite embeds
these public values in browser assets. `deploy/build-frontend.sh` performs
`npm ci`, builds the frontend, checks the expected gateway in the generated
HTML, and rejects old `.supabase.co` or `lovable.app` references in `dist/`.

## Staging action

`.github/workflows/deploy-kfaah.yml` runs **only** through GitHub's manual
Run workflow control. It builds from the source and uploads `dist/` with
`rsync` to `/var/www/kfaah-staging/`. It does not use Docker, run on push,
delete remote files, invoke promotion, or write to `/var/www/kfaah/`.

GitHub Actions secrets:

| Name | Value source |
| --- | --- |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for the Hetzner gateway |
| `HETZNER_HOST` | Hetzner deployment host |
| `HETZNER_USER` | Limited `deploy` user |
| `HETZNER_SSH_KEY` | SSH private key for that user; keep it in GitHub Secrets |
| `HETZNER_KNOWN_HOSTS` | Independently verified, pinned SSH host key entry |

**Compatibility gate:** The server-side report describes a restricted
`kfaah-receive-frontend` command, but the exact receiver interface and
filesystem permissions have not been inspected. The workflow currently
uses ordinary `rsync` into staging. Compare it with the existing server
workflow at `/opt/kfaah/deploy/deploy-hetzner.yml` before running the upload.
If `deploy` must use the restricted receiver, adjust the `rsync` invocation
to match its documented interface. Do not guess the command arguments or
loosen server permissions. Keep the first GitHub run manual and staging only.

The host key needs a trusted fingerprint verified outside the SSH connection;
do not generate it with an unauthenticated `ssh-keyscan` in the workflow.
Do not paste the SSH private key into chat or commit it to Git.

## Promotion gate

1. Confirm the build check passes and the staging receiver accepts the
   upload. Preview the staged frontend without production data writes.
2. Check login, branding, dashboards, storage and required `/functions/v1/`
   endpoints against the running Hetzner gateway. Confirm the live build
   has a recoverable backup and rollback path.
3. Only after explicit approval, use the server's reviewed promotion path
   to replace `/var/www/kfaah`. This workflow does not promote automatically.

Keep Lovable available until the source build works correctly after cutover.
Database dumps and donor files should have encrypted off-server backups,
not Git commits. The repository's `secure-backup.yml` workflow does not
establish that the live server's backups are stored off-server.
