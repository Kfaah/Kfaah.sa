# Kfaah source deployment on Hetzner

The React/TypeScript frontend source is in this repository. The currently
running `/var/www/kfaah` site was copied as a Vite build; it is not connected
to this repository. The running `kfaah-functions` service is a separate server
implementation and must not be replaced by this repository's original
`supabase/functions` without a separate review.

## Build configuration

The previous tracked `.env` containing hosted project values has been removed
from the deployment branch. Set the following environment variables for
**every** Hetzner build; Vite embeds them in browser assets:

- `VITE_SUPABASE_URL`: the public HTTPS URL of the Hetzner Supabase gateway.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the public anon/publishable key for that
  gateway. Never use the service-role key in a `VITE_` variable.
- `KFAAH_DEPLOY_TARGET=production`: rejects an old `*.supabase.co` endpoint.
- `KFAAH_EXPECTED_API_URL`: optional exact URL check against a deployment's
  configured gateway URL.

The manual `.github/workflows/deploy-kfaah.yml` action sets the gateway URL to
`https://kfaah.sa`, runs `bash deploy/build-frontend.sh`, then transfers
`dist/` to `/var/www/kfaah/` with `rsync`. It does not use Docker or
docker-compose. It does not run on push or merge. The workflow needs five
GitHub production environment secrets: `KFAAH_SUPABASE_ANON_KEY`,
`KFAAH_SSH_HOST`, `KFAAH_SSH_USER`, `KFAAH_SSH_PRIVATE_KEY`, and
`KFAAH_SSH_KNOWN_HOSTS`. The SSH identity must have write access to the
existing static site directory. The pinned known-hosts entry is checked
strictly; do not replace it with unverified key scanning in the workflow.

The build checks the embedded API URL and rejects any `.supabase.co` string
in `dist/`. The upload does not use `--delete`, so it will not erase other
files that may be present in `/var/www/kfaah/`. No server files are changed
until someone manually starts the workflow with valid secrets.

## Cutover gate

1. Configure a separate preview site and test backend. Do not run preview
   writes against production donor data.
2. Test login, organization branding, dashboards, storage uploads, and the
   migrated `/functions/v1/` endpoints using the built source in preview.
3. Confirm the generated assets use the Hetzner gateway and contain no old
   hosted Supabase endpoint. Keep a copy of the live `/var/www/kfaah` build.
4. Back up the current `/var/www/kfaah` build and verify a rollback path.
   The workflow connects outward from GitHub Actions over SSH, so the server
   does not need a GitHub clone or a GitHub PAT.
5. Manually run the deployment action, then check authentication and a
   representative page immediately. Consider unattended deployment only
   after preview and rollback work.

Database dumps and donor files belong in an encrypted backup destination,
not in Git. The repository's `secure-backup.yml` workflow is manual and does
not prove that the live server's local backups are stored off-server.
