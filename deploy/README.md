# Hetzner deployment preparation

The frontend has two isolated containers. The production and preview builds
use different Supabase URLs and publishable keys. Docker publishes ports 3100
and 3101 only to the server's loopback interface. Caddy can route separate
HTTPS domains to those ports after DNS and certificates are configured.

The backend, database, files, and Edge Functions are separate Supabase
installations and are never provisioned from this frontend Compose file.
Keep production credentials, the preview credentials, database dumps, and
runtime secrets outside Git. Populate deploy/frontend/.env on the server
from the generated backend credentials before building.

After both backend installations are ready:
- Build the frontend with `docker compose -f deploy/frontend/compose.yaml --env-file deploy/frontend/.env build`.
- Start one or both services with `docker compose -f deploy/frontend/compose.yaml --env-file deploy/frontend/.env up -d`.
- Verify each local HTTP endpoint and the intended production and preview
  domains before moving DNS or stopping the existing Lovable deployment.

The Vite variables are embedded into static assets at build time. Rebuild
the corresponding service if its Supabase URL or publishable key changes.
Do not expose Postgres, Supabase Studio, or the backend gateway directly
without a separately reviewed HTTPS proxy and access policy.
