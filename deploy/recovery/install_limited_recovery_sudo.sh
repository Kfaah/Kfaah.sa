#!/usr/bin/env bash
set -euo pipefail

# One-time root bootstrap. Grants only a root-owned recovery dispatcher,
# never a general root shell and never performs cutover by itself.
# Usage:
#   sudo RECOVERY_OPERATOR=<deploy-user> SOURCE_ROOT=/path/to/reviewed/repo \
#     bash deploy/recovery/install_limited_recovery_sudo.sh

[[ "$EUID" -eq 0 ]] || { echo "ERROR: root required" >&2; exit 1; }

OPERATOR="\${RECOVERY_OPERATOR:-}"
SOURCE_ROOT="\${SOURCE_ROOT:-$(pwd)}"
LIBEXEC="/usr/local/libexec/kfaah-backend-recovery"
SCHEMA_GATE="/usr/local/libexec/kfaah-production-schema-gate"
WRAPPER="/usr/local/bin/kfaah-backend-recovery"
STATE_ROOT="/var/lib/kfaah-recovery"
INCOMING="$STATE_ROOT/incoming"
STAGED="$STATE_ROOT/staged"
SUDOERS="/etc/sudoers.d/kfaah-backend-recovery"

[[ -n "$OPERATOR" ]] || { echo "ERROR: RECOVERY_OPERATOR is required" >&2; exit 1; }
id "$OPERATOR" >/dev/null 2>&1 || { echo "ERROR: unknown operator: $OPERATOR" >&2; exit 1; }
[[ -r "$SOURCE_ROOT/deploy/recovery/kfaah_backend_recovery.sh" ]] || {
  echo "ERROR: reviewed recovery script missing under SOURCE_ROOT" >&2
  exit 1
}
[[ -r "$SOURCE_ROOT/deploy/recovery/kfaah_production_schema_gate.sh" ]] || {
  echo "ERROR: production schema gate missing under SOURCE_ROOT" >&2
  exit 1
}
command -v visudo >/dev/null 2>&1 || { echo "ERROR: visudo unavailable" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 unavailable" >&2; exit 1; }

install -o root -g root -m 0755 \
  "$SOURCE_ROOT/deploy/recovery/kfaah_backend_recovery.sh" \
  "$LIBEXEC"
install -d -o root -g root -m 0700 "$STATE_ROOT" "$STAGED"
install -d -o "$OPERATOR" -g root -m 0750 "$INCOMING"

cat > "$WRAPPER" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail

RECOVERY="/usr/local/libexec/kfaah-backend-recovery"
SCHEMA_GATE="/usr/local/libexec/kfaah-production-schema-gate"
STATE_ROOT="/var/lib/kfaah-recovery"
INCOMING="$STATE_ROOT/incoming"
STAGED="$STATE_ROOT/staged"
BACKUPS="/opt/kfaah/recovery-backups"

die() { echo "ERROR: $*" >&2; exit 1; }
run_mutation() {
  local mode="$1"
  shift || true
  KFAAH_RECOVERY_MODE="$mode" \
  CONFIRM_KFAAH_BACKEND_RECOVERY=yes \
  "$RECOVERY" "$@"
}

[[ "$EUID" -eq 0 ]] || die "wrapper must be invoked through sudo"
[[ -x "$RECOVERY" ]] || die "root-owned recovery operator missing"

mode="\${1:-audit}"
shift || true

case "$mode" in
  audit)
    [[ "$#" -eq 0 ]] || die "audit takes no arguments"
    KFAAH_RECOVERY_MODE=audit "$RECOVERY"
    ;;
  backup)
    [[ "$#" -eq 0 ]] || die "backup takes no arguments"
    run_mutation backup
    ;;
  native-canary)
    [[ "$#" -eq 0 ]] || die "native-canary takes no arguments"
    KFAAH_RECOVERY_MODE=native-canary "$RECOVERY"
    ;;
  install-functions)
    [[ "$#" -eq 2 ]] || die "usage: install-functions <archive.tar.gz> <sha256>"
    archive="$1"
    expected="$2"
    [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || die "invalid sha256"

    archive_real="$(realpath -e "$archive")"
    incoming_real="$(realpath -e "$INCOMING")"
    case "$archive_real" in
      "$incoming_real"/*) ;;
      *) die "archive must be inside $INCOMING" ;;
    esac

    actual="$(sha256sum "$archive_real" | awk '{print $1}')"
    [[ "$actual" == "$expected" ]] || die "archive sha256 mismatch"

    target="$STAGED/$expected"
    rm -rf "$target"
    install -d -o root -g root -m 0700 "$target"

    python3 - "$archive_real" "$target" <<'PY'
import pathlib
import sys
import tarfile

archive = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2]).resolve()
allowed = pathlib.PurePosixPath("supabase/functions")

with tarfile.open(archive, "r:gz") as tf:
    members = tf.getmembers()
    if not members:
        raise SystemExit("empty archive")
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit(f"unsafe path: {member.name}")
        if member.issym() or member.islnk() or member.isdev() or member.isfifo():
            raise SystemExit(f"unsupported member: {member.name}")
        if not (path == allowed or allowed in path.parents):
            raise SystemExit(f"unexpected archive root: {member.name}")
    tf.extractall(target, members=members)

functions = target / "supabase" / "functions"
if not functions.is_dir():
    raise SystemExit("supabase/functions missing")
if not any(p.name == "index.ts" for p in functions.rglob("index.ts")):
    raise SystemExit("no Edge Function entrypoints found")
PY

    SOURCE_ROOT="$target" run_mutation install-functions
    printf '%s\n' "$expected" > "$STATE_ROOT/last-functions-sha256"
    ;;
  schema-gate)
    [[ "$#" -eq 0 ]] || die "schema-gate takes no arguments"
    [[ -x "$SCHEMA_GATE" ]] || die "production schema gate is missing"
    [[ -r "$STATE_ROOT/current-contract/types.ts" ]] || die "current schema contract is missing"
    KFAAH_SCHEMA_GATE_MARK_READY=yes "$SCHEMA_GATE"
    ;;

  cutover)
    [[ "$#" -eq 1 ]] || die "usage: cutover CONFIRM-NATIVE-CUTOVER"
    [[ "$1" == "CONFIRM-NATIVE-CUTOVER" ]] || die "explicit confirmation missing"
    [[ -f "$STATE_ROOT/schema-ready" ]] || die "production schema has not been accepted"
    [[ "$(stat -c '%U:%G:%a' "$STATE_ROOT/schema-ready")" == "root:root:600" ]] ||       die "schema-ready marker must be root-owned mode 600"
    expected_contract="$(cat "$STATE_ROOT/current-contract/types.sha256" 2>/dev/null || true)"
    accepted_contract="$(sed -n 's/^contract_sha256=//p' "$STATE_ROOT/schema-ready" | head -1)"
    [[ -n "$expected_contract" && "$accepted_contract" == "$expected_contract" ]] ||       die "schema acceptance does not match the current source contract"
    KFAAH_RECOVERY_MODE=native-canary "$RECOVERY"
    run_mutation cutover
    ;;
  rollback-last)
    [[ "$#" -eq 0 ]] || die "rollback-last takes no arguments"
    latest="$(find "$BACKUPS" -mindepth 2 -maxdepth 2 -type f -name nginx-kfaah.conf \
      -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
    [[ -n "$latest" && -r "$latest" ]] || die "no nginx recovery backup found"
    ROLLBACK_NGINX_FILE="$latest" run_mutation rollback-nginx
    ;;
  *)
    die "unsupported recovery mode: $mode"
    ;;
esac
WRAP

chown root:root "$WRAPPER"
chmod 0755 "$WRAPPER"

cat > "$SUDOERS.tmp" <<EOF
Defaults!$WRAPPER env_reset
$OPERATOR ALL=(root) NOPASSWD: $WRAPPER *
EOF
chmod 0440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp" >/dev/null
mv "$SUDOERS.tmp" "$SUDOERS"
chmod 0440 "$SUDOERS"
visudo -cf "$SUDOERS" >/dev/null

echo "KFAAH_LIMITED_RECOVERY_BOOTSTRAP=OK"
echo "operator=$OPERATOR"
echo "wrapper=$WRAPPER"
echo "incoming=$INCOMING"
echo "No backend cutover was performed."
