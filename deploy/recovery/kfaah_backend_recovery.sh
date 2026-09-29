#!/usr/bin/env bash
set -euo pipefail

# Kfaah Hetzner backend recovery operator.
# Safe default: audit only. Mutating modes require root + explicit confirmation.
#
# Examples:
#   KFAAH_RECOVERY_MODE=audit ./deploy/recovery/kfaah_backend_recovery.sh
#   sudo KFAAH_RECOVERY_MODE=backup CONFIRM_KFAAH_BACKEND_RECOVERY=yes ./deploy/recovery/kfaah_backend_recovery.sh
#   sudo KFAAH_RECOVERY_MODE=install-functions CONFIRM_KFAAH_BACKEND_RECOVERY=yes SOURCE_ROOT=/path/to/repo ./deploy/recovery/kfaah_backend_recovery.sh
#   sudo KFAAH_RECOVERY_MODE=cutover CONFIRM_KFAAH_BACKEND_RECOVERY=yes ./deploy/recovery/kfaah_backend_recovery.sh
#
# This script intentionally does NOT replay production migrations automatically.
# Schema repair must first pass the repository's local migration-replay CI and an
# operator-reviewed Supabase CLI dry run, as documented in the recovery runbook.

MODE="${KFAAH_RECOVERY_MODE:-audit}"
CONFIRM="${CONFIRM_KFAAH_BACKEND_RECOVERY:-no}"
SOURCE_ROOT="${SOURCE_ROOT:-$(pwd)}"
SUPABASE_ROOT="${KFAAH_SUPABASE_ROOT:-/opt/kfaah/production/supabase}"
NGINX_SITE="${KFAAH_NGINX_SITE:-/etc/nginx/sites-enabled/kfaah}"
BACKUP_ROOT="${KFAAH_RECOVERY_BACKUP_ROOT:-/opt/kfaah/recovery-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

die() { echo "ERROR: $*" >&2; exit 1; }
note() { echo "==> $*"; }

require_mutation_approval() {
  [[ "$EUID" -eq 0 ]] || die "Mutating mode requires an approved root shell."
  [[ "$CONFIRM" == "yes" ]] || die "Set CONFIRM_KFAAH_BACKEND_RECOVERY=yes after reviewing the runbook."
}

detect_compose() {
  [[ -d "$SUPABASE_ROOT" ]] || die "Supabase root not found: $SUPABASE_ROOT"
  cd "$SUPABASE_ROOT"
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  else
    die "Docker Compose is unavailable."
  fi
}

find_functions_dir() {
  local candidate="$SUPABASE_ROOT/volumes/functions"
  [[ -d "$candidate" ]] || die "Native functions volume not found: $candidate"
  FUNCTIONS_DIR="$candidate"
}

audit() {
  note "Kfaah backend recovery audit"
  echo "mode=$MODE"
  echo "host=$(hostname)"
  echo "utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_root=$SOURCE_ROOT"
  echo "supabase_root=$SUPABASE_ROOT"
  echo "nginx_site=$NGINX_SITE"

  [[ -d "$SOURCE_ROOT/supabase/functions" ]] && echo "source_functions=OK" || echo "source_functions=MISSING"
  [[ -d "$SOURCE_ROOT/supabase/migrations" ]] && echo "source_migrations=OK" || echo "source_migrations=MISSING"
  [[ -r "$NGINX_SITE" ]] && echo "nginx_site=READABLE" || echo "nginx_site=UNREADABLE"

  if [[ -d "$SUPABASE_ROOT" ]]; then
    detect_compose
    note "Compose services"
    "${COMPOSE[@]}" config --services 2>/dev/null || true
    find_functions_dir
    echo "functions_volume=$FUNCTIONS_DIR"
    echo "function_dirs=$(find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
  fi

  if [[ -r "$NGINX_SITE" ]]; then
    note "Current functions upstream"
    grep -nE 'location /functions/v1/|proxy_pass http://127\.0\.0\.1:(8000|9001)/functions/v1/' "$NGINX_SITE" || true
  fi

  note "Service states"
  for svc in nginx kfaah-functions kfaah-mail-sync kfaah-offsite-backup; do
    printf '%-28s ' "$svc"
    systemctl is-active "$svc" 2>/dev/null || true
  done

  note "No changes were made"
}

backup_current() {
  require_mutation_approval
  detect_compose
  find_functions_dir
  mkdir -p "$BACKUP_DIR"

  note "Saving configuration snapshots to $BACKUP_DIR"
  cp -a "$NGINX_SITE" "$BACKUP_DIR/nginx-kfaah.conf"
  [[ -r /etc/systemd/system/kfaah-functions.service ]] &&     cp -a /etc/systemd/system/kfaah-functions.service "$BACKUP_DIR/kfaah-functions.service"
  [[ -r /opt/kfaah/functions/app.py ]] &&     cp -a /opt/kfaah/functions/app.py "$BACKUP_DIR/python-functions-app.py"

  tar -C "$(dirname "$FUNCTIONS_DIR")" -czf "$BACKUP_DIR/functions-volume.tar.gz" "$(basename "$FUNCTIONS_DIR")"

  note "Creating PostgreSQL logical dump from the self-hosted DB container"
  if "${COMPOSE[@]}" config --services | grep -qx db; then
    "${COMPOSE[@]}" exec -T db sh -lc '
      export PGPASSWORD="${POSTGRES_PASSWORD:-}"
      pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -Fc
    ' > "$BACKUP_DIR/postgres.dump"
    pg_size="$(wc -c < "$BACKUP_DIR/postgres.dump")"
    [[ "$pg_size" -gt 1024 ]] || die "Database dump is unexpectedly small."
  else
    die "Compose service 'db' not found; refusing to continue without a database backup."
  fi

  if [[ -d "$SUPABASE_ROOT/volumes/storage" ]]; then
    note "Saving Storage volume snapshot"
    tar -C "$SUPABASE_ROOT/volumes" -czf "$BACKUP_DIR/storage-volume.tar.gz" storage
  fi

  (
    cd "$BACKUP_DIR"
    sha256sum ./* > SHA256SUMS
  )
  chmod -R go-rwx "$BACKUP_DIR" || true
  note "Backup complete: $BACKUP_DIR"
}

install_functions() {
  require_mutation_approval
  [[ -d "$SOURCE_ROOT/supabase/functions" ]] || die "Source functions missing under $SOURCE_ROOT"
  detect_compose
  find_functions_dir

  # Never install without a fresh same-run recovery backup.
  backup_current

  note "Preserving built-in main/hello and installing reviewed Kfaah function source"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  [[ -d "$FUNCTIONS_DIR/main" ]] && cp -a "$FUNCTIONS_DIR/main" "$tmp/main"
  [[ -d "$FUNCTIONS_DIR/hello" ]] && cp -a "$FUNCTIONS_DIR/hello" "$tmp/hello"

  find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1     ! -name main ! -name hello -exec rm -rf {} +
  cp -a "$SOURCE_ROOT/supabase/functions/." "$FUNCTIONS_DIR/"

  [[ -d "$tmp/main" ]] && { rm -rf "$FUNCTIONS_DIR/main"; cp -a "$tmp/main" "$FUNCTIONS_DIR/main"; }
  [[ -d "$tmp/hello" ]] && { rm -rf "$FUNCTIONS_DIR/hello"; cp -a "$tmp/hello" "$FUNCTIONS_DIR/hello"; }

  chown -R --reference="$FUNCTIONS_DIR" "$FUNCTIONS_DIR" 2>/dev/null || true

  note "Recreating native functions service"
  services="$("${COMPOSE[@]}" config --services)"
  if grep -qx functions <<<"$services"; then
    "${COMPOSE[@]}" up -d --force-recreate functions
  else
    die "Compose service 'functions' not found."
  fi

  note "Native source installed. Public Nginx upstream has NOT been changed."
  note "Run canary checks before cutover."
}

native_canary() {
  detect_compose
  find_functions_dir
  note "Native Edge Runtime canary through the self-hosted API gateway"

  local base="http://127.0.0.1:8000"
  local failed=0
  local fn
  local code

  for fn in hello generate-plan-deep analyze-uploaded-file run-intelligence \
            generate-executive-plans marketing-radar report-suggestions \
            send-transactional-email create-employee org-self-signup; do
    code="$(curl --connect-timeout 3 --max-time 12 -sS \
      -o /tmp/kfaah-native-canary.out \
      -w '%{http_code}' -X OPTIONS "$base/functions/v1/$fn" || true)"
    bytes="$(wc -c < /tmp/kfaah-native-canary.out 2>/dev/null || echo 0)"
    echo "$fn|HTTP=$code|bytes=$bytes"

    if [[ "$fn" != "hello" && "$code" == "500" ]] && \
       grep -q 'could not find an appropriate entrypoint' \
         /tmp/kfaah-native-canary.out 2>/dev/null; then
      failed=1
    fi
  done

  [[ "$failed" -eq 0 ]] || \
    die "One or more native Kfaah functions still has no runtime entrypoint."

  note "Resolving the active legacy client key without printing it"
  local anon_key
  anon_key="$("\${COMPOSE[@]}" exec -T functions sh -lc \
    'printf %s "$SUPABASE_ANON_KEY"' 2>/dev/null || true)"
  [[ -n "$anon_key" ]] || \
    die "SUPABASE_ANON_KEY is unavailable inside the native functions service."

  note "Testing a real native function call using the current browser key contract"
  local demo_json
  demo_json="$(curl --connect-timeout 5 --max-time 30 --fail-with-body -sS \
    -X POST "$base/functions/v1/setup-demo" \
    -H "apikey: $anon_key" \
    -H "Authorization: Bearer $anon_key" \
    -H 'Content-Type: application/json' \
    -d '{}' || true)"

  local demo_email demo_password
  demo_email="$(printf '%s' "$demo_json" | python3 -c \
    'import json,sys; d=json.load(sys.stdin); print(d.get("email",""))' \
    2>/dev/null || true)"
  demo_password="$(printf '%s' "$demo_json" | python3 -c \
    'import json,sys; d=json.load(sys.stdin); print(d.get("password",""))' \
    2>/dev/null || true)"

  [[ -n "$demo_email" && -n "$demo_password" ]] || \
    die "Native setup-demo did not return usable demo credentials."

  note "Testing Auth login against the same native gateway"
  local login_json access_token
  login_json="$(python3 - "$demo_email" "$demo_password" <<'PY' | \
    curl --connect-timeout 5 --max-time 30 --fail-with-body -sS \
      -X POST "$base/auth/v1/token?grant_type=password" \
      -H "apikey: $anon_key" \
      -H 'Content-Type: application/json' \
      --data-binary @- || true
import json, sys
print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))
PY
  )"

  access_token="$(printf '%s' "$login_json" | python3 -c \
    'import json,sys; d=json.load(sys.stdin); print(d.get("access_token",""))' \
    2>/dev/null || true)"
  [[ -n "$access_token" ]] || \
    die "Native Auth login failed with the browser key contract."

  note "Testing a protected Kfaah function with a real user JWT"
  local protected_code
  protected_code="$(curl --connect-timeout 5 --max-time 20 -sS \
    -o /tmp/kfaah-native-protected.out \
    -w '%{http_code}' \
    -X POST "$base/functions/v1/impersonate-user" \
    -H "apikey: $anon_key" \
    -H "Authorization: Bearer $access_token" \
    -H 'Content-Type: application/json' \
    -d '{}' || true)"

  # The demo viewer is authenticated but not a super admin, so 403 is the
  # expected result. 401 means the native auth/key contract is still broken.
  [[ "$protected_code" == "403" ]] || \
    die "Protected native function auth canary failed (expected HTTP 403, got $protected_code)."

  unset anon_key demo_json demo_email demo_password login_json access_token
  note "Native entrypoint + Auth + protected-function canaries passed."
}

cutover() {
  require_mutation_approval
  [[ -r "$NGINX_SITE" ]] || die "Nginx site is not readable."
  native_canary

  backup_current

  grep -q 'proxy_pass http://127.0.0.1:9001/functions/v1/;' "$NGINX_SITE" ||     die "Expected Python functions upstream was not found; refusing an ambiguous edit."

  note "Switching /functions/v1/ from Python :9001 to native Supabase gateway :8000"
  sed -i     's#proxy_pass http://127.0.0.1:9001/functions/v1/;#proxy_pass http://127.0.0.1:8000/functions/v1/;#'     "$NGINX_SITE"

  if ! nginx -t; then
    cp -a "$BACKUP_DIR/nginx-kfaah.conf" "$NGINX_SITE"
    nginx -t || true
    die "Nginx validation failed; prior configuration restored."
  fi
  systemctl reload nginx
  note "Cutover complete. Keep kfaah-functions/Python gateway available for rollback."
}

rollback_nginx() {
  require_mutation_approval
  local source="${ROLLBACK_NGINX_FILE:-}"
  [[ -n "$source" && -r "$source" ]] ||     die "Set ROLLBACK_NGINX_FILE to a reviewed nginx-kfaah.conf backup."
  cp -a "$source" "$NGINX_SITE"
  nginx -t
  systemctl reload nginx
  note "Nginx functions route rolled back."
}

case "$MODE" in
  audit) audit ;;
  backup) backup_current ;;
  install-functions) install_functions ;;
  native-canary) native_canary ;;
  cutover) cutover ;;
  rollback-nginx) rollback_nginx ;;
  *) die "Unknown KFAAH_RECOVERY_MODE: $MODE" ;;
esac
