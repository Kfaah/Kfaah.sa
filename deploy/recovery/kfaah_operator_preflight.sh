#!/usr/bin/env bash
set -euo pipefail

# Read-only production release gate for Kfaah backend recovery.
# Makes no changes. It exits non-zero if a hard prerequisite is missing.

SOURCE_ROOT="${SOURCE_ROOT:-$(pwd)}"
RECOVERY_SCRIPT="${KFAAH_RECOVERY_SCRIPT:-$SOURCE_ROOT/deploy/recovery/kfaah_backend_recovery.sh}"
SUPABASE_ROOT="${KFAAH_SUPABASE_ROOT:-/opt/kfaah/production/supabase}"
NGINX_SITE="${KFAAH_NGINX_SITE:-/etc/nginx/sites-enabled/kfaah}"
FUNCTIONS_DIR="${KFAAH_FUNCTIONS_DIR:-$SUPABASE_ROOT/volumes/functions}"
EXPECTED_FUNCTIONS_UPSTREAM="${KFAAH_EXPECTED_FUNCTIONS_UPSTREAM:-9001}"

failures=0
warnings=0

pass() { printf 'PASS|%s\n' "$*"; }
warn() { printf 'WARN|%s\n' "$*"; warnings=$((warnings+1)); }
fail() { printf 'FAIL|%s\n' "$*"; failures=$((failures+1)); }

echo "KFAAH_PRODUCTION_PREFLIGHT"
echo "UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "HOST=$(hostname)"
echo "USER=$(id -un)"
echo

[[ -d "$SOURCE_ROOT/supabase/functions" ]]   && pass "source functions present"   || fail "source functions missing: $SOURCE_ROOT/supabase/functions"

[[ -d "$SOURCE_ROOT/supabase/migrations" ]]   && pass "source migrations present"   || fail "source migrations missing: $SOURCE_ROOT/supabase/migrations"

if [[ -r "$RECOVERY_SCRIPT" ]]; then
  if bash -n "$RECOVERY_SCRIPT"; then
    pass "recovery operator shell syntax"
  else
    fail "recovery operator shell syntax"
  fi
else
  fail "recovery operator script missing"
fi

if [[ -r "$NGINX_SITE" ]]; then
  pass "nginx site readable"
  if grep -q "proxy_pass http://127.0.0.1:$EXPECTED_FUNCTIONS_UPSTREAM/functions/v1/;" "$NGINX_SITE"; then
    pass "functions upstream is the expected pre-cutover port $EXPECTED_FUNCTIONS_UPSTREAM"
  else
    fail "functions upstream differs from expected pre-cutover port $EXPECTED_FUNCTIONS_UPSTREAM"
  fi
else
  fail "nginx site unreadable: $NGINX_SITE"
fi

if command -v nginx >/dev/null 2>&1; then
  if nginx -t >/tmp/kfaah-nginx-preflight.out 2>&1; then
    pass "nginx configuration validates"
  else
    fail "nginx configuration validation failed"
    sed -n '1,20p' /tmp/kfaah-nginx-preflight.out || true
  fi
else
  warn "nginx command unavailable to this account"
fi

for port in 8000 9001; do
  if curl --connect-timeout 2 --max-time 5 -sS -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then
    pass "localhost port $port responds"
  else
    warn "localhost port $port did not return a normal HTTP response"
  fi
done

if [[ -d "$FUNCTIONS_DIR" ]]; then
  pass "native functions volume exists"
  count="$(find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  echo "INFO|native_function_directories=$count"
  for fn in main hello setup-demo create-employee process-upload deep-org-analysis; do
    [[ -r "$FUNCTIONS_DIR/$fn/index.ts" ]]       && pass "native function entrypoint: $fn"       || warn "native function entrypoint missing: $fn"
  done
else
  fail "native functions volume missing: $FUNCTIONS_DIR"
fi

if command -v docker >/dev/null 2>&1 && [[ -d "$SUPABASE_ROOT" ]]; then
  (
    cd "$SUPABASE_ROOT"
    if docker compose version >/dev/null 2>&1; then
      compose=(docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
      compose=(docker-compose)
    else
      exit 8
    fi

    services="$("${compose[@]}" config --services 2>/dev/null || true)"
    for svc in db storage functions; do
      if grep -qx "$svc" <<<"$services"; then
        printf 'PASS|compose service present: %s\n' "$svc"
      else
        printf 'FAIL|compose service missing: %s\n' "$svc"
        exit 9
      fi
    done

    if "${compose[@]}" ps --status running 2>/dev/null | grep -q .; then
      printf 'PASS|compose has running services\n'
    else
      printf 'WARN|compose returned no running-service rows\n'
    fi
  ) || fail "docker compose production contract"
else
  warn "docker/supabase root unavailable to this account"
fi

if [[ -r "$SUPABASE_ROOT/.env" ]]; then
  if grep -qE '^FILE_SIZE_LIMIT=' "$SUPABASE_ROOT/.env"; then
    pass "storage FILE_SIZE_LIMIT declared"
  else
    warn "storage FILE_SIZE_LIMIT not declared in production .env"
  fi
else
  warn "production Supabase .env is not readable"
fi

if [[ -r "$NGINX_SITE" ]]; then
  storage_limit="$(awk '
    /location \/storage\/v1\// {in_storage=1}
    in_storage && /client_max_body_size/ {print $2; exit}
    in_storage && /^[[:space:]]*}/ {in_storage=0}
  ' "$NGINX_SITE" | tr -d ';')"
  if [[ -n "$storage_limit" ]]; then
    echo "INFO|nginx_storage_client_max_body_size=$storage_limit"
  else
    warn "no storage-specific client_max_body_size found"
  fi
fi

echo
echo "SUMMARY|failures=$failures|warnings=$warnings"
if [[ "$failures" -gt 0 ]]; then
  echo "KFAAH_PRODUCTION_PREFLIGHT=FAIL"
  exit 1
fi

echo "KFAAH_PRODUCTION_PREFLIGHT=PASS"
