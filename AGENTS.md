# Kfaah Codex instructions

This repository powers kfaah.sa.

## Safety and deployment
- Never deploy directly to the live site from a Codex task.
- Work only on the pull-request branch created for the request.
- Do not modify Hetzner, DNS, secrets, billing, authentication credentials, or production databases.
- Do not add back Lovable, lovable.app, lovable.dev, ai.gateway.lovable.dev, or hosted *.supabase.co dependencies.
- Preserve VITE_SUPABASE_URL=https://kfaah.sa for production builds.
- Run the relevant checks before finishing. At minimum, keep the existing source/build independence checks passing.
- Keep changes focused on the request file in .kfaah/requests/.
- Leave deployment to the existing staging -> explicit live promotion workflow.

## Request source
Kfaah Manager requests are stored under .kfaah/requests/*.md.
Treat the newest request file referenced from the PR as the source of truth for the requested change.
