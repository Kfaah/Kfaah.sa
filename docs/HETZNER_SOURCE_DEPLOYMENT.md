# Kfaah source deployment on Hetzner

The React/TypeScript frontend source is in this repository. The currently
running `/var/www/kfaah` site was copied as a Vite build; it is not connected
to this repository. The running `kfaah-functions` service is a separate server
implementation and must not be replaced by this repository's original
`supabase/functions` without a separate review.

## Build configuration

The tracked `.env` contains the previous hosted project values. Set the
following environment variables explicitly for **every** Hetzner build; Vite
embeds them in browser assets:

- `VITE_SUPABASE_URL`: the public HTTPS URL of the Hetzner Supabase gateway.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the public anon/publishable key for that
  gateway. Never use the service-role key in a `VITE_` variable.
- `KFAAH_DEPLOY_TARGET=production`: rejects an old `*.supabase.co` endpoint.
- `KFAAH_EXPECTED_API_URL`: optional exact URL check against a deployment's
  configured gateway URL.

Run `bash deploy/build-frontend.sh` in a clean checkout with those variables
set through the server's protected environment. It runs `npm ci`, builds the
site, and checks the URL embedded in `dist/index.html`. The script does not
change the live site.

## Cutover gate

1. Configure a separate preview site and test backend. Do not run preview
   writes against production donor data.
2. Test login, organization branding, dashboards, storage uploads, and the
   migrated `/functions/v1/` endpoints using the built source in preview.
3. Confirm the generated assets use the Hetzner gateway and contain no old
   hosted Supabase endpoint. Keep a copy of the live `/var/www/kfaah` build.
4. Configure read-only GitHub access on the server, then use an atomic release
   directory and a documented rollback to switch the live frontend. Check
   authentication and a representative page immediately after the switch.
5. Enable unattended deployment only after preview and rollback work. A merge
   to `main` alone must not alter production until that link has been tested.

Database dumps and donor files belong in an encrypted backup destination,
not in Git. The repository's `secure-backup.yml` workflow is manual and does
not prove that the live server's local backups are stored off-server.
