#!/usr/bin/env bash
set -u

# Read-only Hetzner recovery inventory for Kfaah.
# Intended for an operator-approved root shell. It never changes services,
# files, Docker state, database rows, or environment values.

echo "KFAAH READ-ONLY HETZNER RECOVERY AUDIT"
echo "UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "HOST=$(hostname)"
echo "USER=$(id -un)"
echo

echo "=== SYSTEMD STATES ==="
for svc in nginx kfaah-functions kfaah-supabase kfaah-mail-sync kfaah-offsite-backup docker postgresql postgrest; do
  printf '%-30s ' "$svc"
  systemctl is-active "$svc" 2>/dev/null || true
done
echo

echo "=== KFAAH NGINX ROUTES / BODY LIMITS ==="
if [[ -r /etc/nginx/sites-enabled/kfaah ]]; then
  grep -nE 'server_name|client_max_body_size|location /(auth|rest|storage|functions|realtime|pg)/|proxy_pass'     /etc/nginx/sites-enabled/kfaah || true
else
  echo "UNREADABLE /etc/nginx/sites-enabled/kfaah"
fi
echo

echo "=== CUSTOM FUNCTIONS GATEWAY ==="
if [[ -r /etc/systemd/system/kfaah-functions.service ]]; then
  grep -E '^(Description|ExecStart|WorkingDirectory|EnvironmentFile|User|Group)='     /etc/systemd/system/kfaah-functions.service || true
else
  echo "UNREADABLE kfaah-functions.service"
fi
if [[ -r /opt/kfaah/functions/app.py ]]; then
  echo "python_gateway_sha256=$(sha256sum /opt/kfaah/functions/app.py | awk '{print $1}')"
  echo "python_gateway_bytes=$(wc -c < /opt/kfaah/functions/app.py)"
else
  echo "python_gateway=UNREADABLE_OR_MISSING"
fi
echo

echo "=== LISTENING PORTS ==="
ss -ltnp 2>/dev/null | grep -E ':(3000|5432|6543|8000|9001|9999)[[:space:]]' || true
echo

echo "=== DOCKER CONTAINERS ==="
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format 'NAME={{.Names}} IMAGE={{.Image}} STATUS={{.Status}} PORTS={{.Ports}}' 2>/dev/null     | grep -Ei 'supabase|kong|auth|rest|storage|realtime|edge|function|studio|meta|vector|postgres|pool|imgproxy' || true
else
  echo "docker command not found"
fi
echo

echo "=== EDGE RUNTIME CANDIDATES ==="
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null     | grep -Ei 'edge-runtime|functions|supabase-edge' || echo "NO_EDGE_RUNTIME_CONTAINER_DETECTED"
fi
ps -eo user,pid,comm,args 2>/dev/null   | grep -Ei '[d]eno|[e]dge-runtime|[s]upabase.*functions' || true
echo

echo "=== COMPOSE / RELEASE CANDIDATES ==="
for root in /opt/kfaah /opt/supabase /srv /root /home/deploy; do
  [[ -d "$root" ]] || continue
  find "$root" -maxdepth 5 -type f \
    \( -name 'docker-compose.yml' -o -name 'docker-compose.yaml' -o -name 'compose.yml' -o -name 'compose.yaml' -o -name '.supabase-version' -o -name 'run.sh' \) \
    -print 2>/dev/null
done | sort -u | head -200
echo

echo "=== FUNCTION SOURCE VOLUME CANDIDATES ==="
for base in /opt/kfaah /opt/supabase /srv /root /home/deploy; do
  [[ -d "$base" ]] || continue
  find "$base" -maxdepth 7 -type d \
    \( -path '*/volumes/functions' -o -path '*/supabase/functions' \)     -print 2>/dev/null
done | sort -u | head -100
echo

echo "=== SAFE ENV VARIABLE NAMES (VALUES NEVER PRINTED) ==="
for envfile in   /opt/kfaah/production/supabase/.env   /opt/kfaah/production/supabase/.env.functions   /opt/kfaah/.env   /opt/kfaah/functions/.env   /etc/kfaah/functions.env; do
  [[ -r "$envfile" ]] || continue
  echo "--- $envfile ---"
  sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=.*/\2/p' "$envfile"     | grep -E '^(SUPABASE_|KFAAH_|FIRECRAWL_|ZOHO_|GMAIL_|FILE_SIZE_LIMIT|FUNCTIONS_|JWT_|API_EXTERNAL_URL|SITE_URL)'     | sort -u
done
echo

echo "=== FILE SIZE LIMIT DECLARATIONS (NAMES/LOCATIONS ONLY) ==="
for cfg in   /opt/kfaah/production/supabase/.env   /opt/kfaah/production/supabase/docker-compose.yml   /opt/kfaah/production/supabase/docker-compose.yaml   /opt/kfaah/production/supabase/compose.yml   /opt/kfaah/production/supabase/compose.yaml; do
  [[ -r "$cfg" ]] || continue
  grep -nE 'FILE_SIZE_LIMIT|client_max_body_size' "$cfg" 2>/dev/null     | sed -E 's/(FILE_SIZE_LIMIT[=:][[:space:]]*).*/\1<redacted>/' || true
done
echo

echo "=== STORAGE / DATABASE VOLUME SIZES ==="
if command -v docker >/dev/null 2>&1; then
  docker volume ls --format '{{.Name}}' 2>/dev/null     | grep -Ei 'supabase|storage|postgres|db'     | while read -r vol; do
        mp=$(docker volume inspect -f '{{.Mountpoint}}' "$vol" 2>/dev/null || true)
        if [[ -n "$mp" && -d "$mp" ]]; then
          printf '%s ' "$vol"
          du -sh "$mp" 2>/dev/null | awk '{print $1}'
        fi
      done
fi
echo

echo "=== SERVICE LOG TAILS (SANITIZED BY JOURNAL, NO ENV DUMP) ==="
for svc in kfaah-functions kfaah-mail-sync kfaah-offsite-backup; do
  echo "--- $svc ---"
  journalctl -u "$svc" -n 30 --no-pager 2>/dev/null     | sed -E 's/(Bearer|apikey|token|password|secret|key)[=: ]+[^ ,;]+/\1=<redacted>/Ig'     | tail -30 || true
done
echo

echo "AUDIT_COMPLETE"
