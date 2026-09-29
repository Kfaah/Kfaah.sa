#!/usr/bin/env bash
set -euo pipefail

# One-time root bootstrap for a narrowly scoped Kfaah recovery dispatcher.
# It grants no shell and performs no backend mutation by itself.
#
# Usage:
#   sudo RECOVERY_OPERATOR=<deploy-user> SOURCE_ROOT=/path/to/reviewed/repo \
#     bash deploy/recovery/install_limited_recovery_sudo.sh

[[ "$EUID" -eq 0 ]] || { echo "ERROR: root required" >&2; exit 1; }

OPERATOR="\${RECOVERY_OPERATOR:-}"
SOURCE_ROOT="\${SOURCE_ROOT:-$(pwd)}"

RECOVERY="/usr/local/libexec/kfaah-backend-recovery"
SCHEMA_GATE="/usr/local/libexec/kfaah-production-schema-gate"
SCHEMA_PLAN="/usr/local/libexec/kfaah-schema-recovery-plan"
WRAPPER="/usr/local/bin/kfaah-backend-recovery"

STATE_ROOT="/var/lib/kfaah-recovery"
INCOMING="$STATE_ROOT/incoming"
STAGED="$STATE_ROOT/staged"
CONTRACT_DIR="$STATE_ROOT/current-contract"
SUDOERS="/etc/sudoers.d/kfaah-backend-recovery"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$OPERATOR" ]] || die "RECOVERY_OPERATOR is required"
id "$OPERATOR" >/dev/null 2>&1 || die "unknown operator: $OPERATOR"
command -v visudo >/dev/null 2>&1 || die "visudo unavailable"
command -v python3 >/dev/null 2>&1 || die "python3 unavailable"

for required in \
  deploy/recovery/kfaah_backend_recovery.sh \
  deploy/recovery/kfaah_production_schema_gate.sh \
  deploy/recovery/kfaah_schema_recovery_plan.sh
do
  [[ -r "$SOURCE_ROOT/$required" ]] || die "reviewed script missing: $required"
done

install -o root -g root -m 0755 \
  "$SOURCE_ROOT/deploy/recovery/kfaah_backend_recovery.sh" "$RECOVERY"
install -o root -g root -m 0755 \
  "$SOURCE_ROOT/deploy/recovery/kfaah_production_schema_gate.sh" "$SCHEMA_GATE"
install -o root -g root -m 0755 \
  "$SOURCE_ROOT/deploy/recovery/kfaah_schema_recovery_plan.sh" "$SCHEMA_PLAN"

install -d -o root -g root -m 0700 \
  "$STATE_ROOT" "$STAGED" "$CONTRACT_DIR"
install -d -o "$OPERATOR" -g root -m 0750 "$INCOMING"

cat > "$WRAPPER" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail

RECOVERY="/usr/local/libexec/kfaah-backend-recovery"
SCHEMA_GATE="/usr/local/libexec/kfaah-production-schema-gate"
SCHEMA_PLAN="/usr/local/libexec/kfaah-schema-recovery-plan"

STATE_ROOT="/var/lib/kfaah-recovery"
INCOMING="$STATE_ROOT/incoming"
STAGED="$STATE_ROOT/staged"
CONTRACT_DIR="$STATE_ROOT/current-contract"
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
[[ -x "$SCHEMA_GATE" ]] || die "root-owned schema gate missing"
[[ -x "$SCHEMA_PLAN" ]] || die "root-owned schema plan missing"

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

functions_root = pathlib.PurePosixPath("supabase/functions")
migrations_root = pathlib.PurePosixPath("supabase/migrations")
types_file = pathlib.PurePosixPath("src/integrations/supabase/types.ts")

with tarfile.open(archive, "r:gz") as tf:
    members = tf.getmembers()
    if not members:
        raise SystemExit("empty archive")

    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit(f"unsafe archive path: {member.name}")
        if member.issym() or member.islnk() or member.isdev() or member.isfifo():
            raise SystemExit(f"unsupported archive member: {member.name}")

        allowed = (
            path == functions_root
            or functions_root in path.parents
            or path == migrations_root
            or migrations_root in path.parents
            or path == types_file
        )
        if not allowed:
            raise SystemExit(f"unexpected archive path: {member.name}")

    tf.extractall(target, members=members)

functions = target / "supabase" / "functions"
migrations = target / "supabase" / "migrations"
types = target / "src" / "integrations" / "supabase" / "types.ts"

if not functions.is_dir():
    raise SystemExit("supabase/functions missing")
if not any(p.name == "index.ts" for p in functions.rglob("index.ts")):
    raise SystemExit("no Edge Function entrypoints found")
if not migrations.is_dir() or not any(migrations.glob("*.sql")):
    raise SystemExit("supabase/migrations missing")
if not types.is_file():
    raise SystemExit("types.ts schema contract missing")
PY

    # The recovery operator performs its own fresh DB/storage/config backup
    # before replacing the native function volume.
    SOURCE_ROOT="$target" run_mutation install-functions

    rm -rf "$CONTRACT_DIR"
    install -d -o root -g root -m 0700 "$CONTRACT_DIR"
    install -o root -g root -m 0600 \
      "$target/src/integrations/supabase/types.ts" \
      "$CONTRACT_DIR/types.ts"
    cp -a "$target/supabase/migrations" "$CONTRACT_DIR/migrations"
    chown -R root:root "$CONTRACT_DIR/migrations"
    chmod -R go-rwx "$CONTRACT_DIR/migrations"

    sha256sum "$CONTRACT_DIR/types.ts" | awk '{print $1}' \
      > "$CONTRACT_DIR/types.sha256"
    (
      cd "$CONTRACT_DIR/migrations"
      find . -maxdepth 1 -type f -name '*.sql' -print0 \
        | sort -z \
        | xargs -0 sha256sum
    ) > "$CONTRACT_DIR/migrations.sha256"

    chown root:root "$CONTRACT_DIR/types.sha256" "$CONTRACT_DIR/migrations.sha256"
    chmod 0600 "$CONTRACT_DIR/types.sha256" "$CONTRACT_DIR/migrations.sha256"

    # Any new source contract invalidates an older production acceptance.
    rm -f "$STATE_ROOT/schema-ready"

    printf '%s\n' "$expected" > "$STATE_ROOT/last-functions-sha256"
    chown root:root "$STATE_ROOT/last-functions-sha256"
    chmod 0600 "$STATE_ROOT/last-functions-sha256"
    ;;

  schema-plan)
    [[ "$#" -eq 0 ]] || die "schema-plan takes no arguments"
    [[ -r "$CONTRACT_DIR/types.ts" ]] || die "current schema contract missing"
    [[ -d "$CONTRACT_DIR/migrations" ]] || die "current migration bundle missing"
    "$SCHEMA_PLAN"
    ;;

  schema-gate)
    [[ "$#" -eq 0 ]] || die "schema-gate takes no arguments"
    [[ -r "$CONTRACT_DIR/types.ts" ]] || die "current schema contract missing"
    KFAAH_SCHEMA_GATE_MARK_READY=yes "$SCHEMA_GATE"
    ;;

  cutover)
    [[ "$#" -eq 1 ]] || die "usage: cutover CONFIRM-NATIVE-CUTOVER"
    [[ "$1" == "CONFIRM-NATIVE-CUTOVER" ]] || die "explicit confirmation missing"
    [[ -f "$STATE_ROOT/schema-ready" ]] || die "production schema has not been accepted"
    [[ "$(stat -c '%U:%G:%a' "$STATE_ROOT/schema-ready")" == "root:root:600" ]] \
      || die "schema-ready marker must be root-owned mode 600"

    current_contract="$(cat "$CONTRACT_DIR/types.sha256" 2>/dev/null || true)"
    accepted_contract="$(sed -n 's/^contract_sha256=//p' "$STATE_ROOT/schema-ready" | head -1)"
    [[ -n "$current_contract" && "$accepted_contract" == "$current_contract" ]] \
      || die "schema acceptance does not match current source contract"

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
