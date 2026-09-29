#!/usr/bin/env bash
set -euo pipefail

# Build a no-network disposable clone of the live Supabase PostgreSQL database,
# apply source migrations missing from the live migration ledger to the clone,
# then validate the clone against the committed application contract.
#
# The live database is read only. This script creates only:
# - a pg_dump/schema dump under /var/lib/kfaah-recovery/schema-plans
# - a temporary Docker container + volume that are removed on exit.

[[ "$EUID" -eq 0 ]] || { echo "ERROR: root required" >&2; exit 1; }

SUPABASE_ROOT="\${KFAAH_SUPABASE_ROOT:-/opt/kfaah/production/supabase}"
STATE_ROOT="\${KFAAH_RECOVERY_STATE_ROOT:-/var/lib/kfaah-recovery}"
CONTRACT="\${KFAAH_SCHEMA_TYPES:-$STATE_ROOT/current-contract/types.ts}"
MIGRATIONS="\${KFAAH_SCHEMA_MIGRATIONS:-$STATE_ROOT/current-contract/migrations}"
PLAN_ROOT="$STATE_ROOT/schema-plans"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PLAN_DIR="$PLAN_ROOT/$STAMP"
CLONE="kfaah-schema-plan-$STAMP"
VOLUME="$CLONE-data"
CLONE_PASSWORD="$(openssl rand -hex 24)"

die() { echo "ERROR: $*" >&2; exit 1; }
note() { echo "==> $*"; }

[[ -r "$CONTRACT" ]] || die "schema contract missing: $CONTRACT"
[[ -d "$MIGRATIONS" ]] || die "migration bundle missing: $MIGRATIONS"
[[ -d "$SUPABASE_ROOT" ]] || die "Supabase root missing: $SUPABASE_ROOT"
command -v docker >/dev/null 2>&1 || die "docker unavailable"
command -v python3 >/dev/null 2>&1 || die "python3 unavailable"
command -v openssl >/dev/null 2>&1 || die "openssl unavailable"

install -d -o root -g root -m 0700 "$PLAN_ROOT" "$PLAN_DIR"

cd "$SUPABASE_ROOT"
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Docker Compose unavailable"
fi

db_container="$("\${COMPOSE[@]}" ps -q db)"
[[ -n "$db_container" ]] || die "live DB container not found"
db_image="$(docker inspect -f '{{.Config.Image}}' "$db_container")"
[[ -n "$db_image" ]] || die "could not determine live DB image"
printf '%s\n' "$db_image" > "$PLAN_DIR/db-image.txt"

cleanup() {
  docker rm -f "$CLONE" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  unset CLONE_PASSWORD
}
trap cleanup EXIT

live_db="$("\${COMPOSE[@]}" exec -T db sh -lc 'printf %s "\${POSTGRES_DB:-postgres}"')"
[[ -n "$live_db" ]] || live_db=postgres

note "Creating live logical dump and schema fingerprint (read-only)"
"\${COMPOSE[@]}" exec -T db sh -lc '
  export PGPASSWORD="\${POSTGRES_PASSWORD:-}"
  exec pg_dump -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-postgres}" -Fc
' > "$PLAN_DIR/live.dump"

"\${COMPOSE[@]}" exec -T db sh -lc '
  export PGPASSWORD="\${POSTGRES_PASSWORD:-}"
  exec pg_dump -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-postgres}" --schema-only
' > "$PLAN_DIR/live-schema.sql"

[[ "$(wc -c < "$PLAN_DIR/live.dump")" -gt 1024 ]] || die "live dump unexpectedly small"
sha256sum "$PLAN_DIR/live.dump" | awk '{print $1}' > "$PLAN_DIR/live-dump.sha256"
sha256sum "$PLAN_DIR/live-schema.sql" | awk '{print $1}' > "$PLAN_DIR/live-schema.sha256"
sha256sum "$CONTRACT" | awk '{print $1}' > "$PLAN_DIR/contract.sha256"

note "Reading live migration ledger"
if "\${COMPOSE[@]}" exec -T db sh -lc '
  export PGPASSWORD="\${POSTGRES_PASSWORD:-}"
  psql -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-postgres}" -X -At \
    -c "select to_regclass('\''supabase_migrations.schema_migrations'\'') is not null"
' | grep -qx t; then
  "\${COMPOSE[@]}" exec -T db sh -lc '
    export PGPASSWORD="\${POSTGRES_PASSWORD:-}"
    exec psql -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-postgres}" -X -At \
      -c "select version from supabase_migrations.schema_migrations order by version"
  ' > "$PLAN_DIR/live-versions.txt"
else
  : > "$PLAN_DIR/live-versions.txt"
fi

note "Starting isolated no-network clone with image $db_image"
docker volume create "$VOLUME" >/dev/null
docker run -d \
  --name "$CLONE" \
  --network none \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$CLONE_PASSWORD" \
  -e POSTGRES_DB=postgres \
  -v "$VOLUME:/var/lib/postgresql/data" \
  "$db_image" >/dev/null

ready=no
for _ in $(seq 1 90); do
  if docker exec -e PGPASSWORD="$CLONE_PASSWORD" "$CLONE" \
    pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=yes
    break
  fi
  sleep 1
done
[[ "$ready" == yes ]] || {
  docker logs "$CLONE" > "$PLAN_DIR/clone-startup.log" 2>&1 || true
  die "isolated PostgreSQL clone did not become ready"
}

note "Restoring the live dump into the isolated clone"
cat "$PLAN_DIR/live.dump" | docker exec -i \
  -e PGPASSWORD="$CLONE_PASSWORD" "$CLONE" \
  pg_restore -U postgres -d postgres --no-owner --no-privileges --exit-on-error

: > "$PLAN_DIR/missing-migrations.txt"
: > "$PLAN_DIR/applied-to-clone.txt"

note "Applying source migrations absent from the live ledger to the clone only"
while IFS= read -r file; do
  base="$(basename "$file")"
  version="\${base%%_*}"
  [[ "$version" =~ ^[0-9]{14}$ ]] || continue

  if grep -qx "$version" "$PLAN_DIR/live-versions.txt"; then
    continue
  fi

  printf '%s\n' "$base" >> "$PLAN_DIR/missing-migrations.txt"
  note "Clone apply: $base"
  if ! cat "$file" | docker exec -i \
    -e PGPASSWORD="$CLONE_PASSWORD" "$CLONE" \
    psql -U postgres -d postgres -X -v ON_ERROR_STOP=1; then
    printf '%s\n' "$base" > "$PLAN_DIR/failed-migration.txt"
    docker logs "$CLONE" > "$PLAN_DIR/clone.log" 2>&1 || true
    die "clone migration failed: $base"
  fi
  printf '%s\n' "$base" >> "$PLAN_DIR/applied-to-clone.txt"
done < <(find "$MIGRATIONS" -maxdepth 1 -type f -name '*.sql' | sort)

note "Querying clone schema contract"
docker exec -e PGPASSWORD="$CLONE_PASSWORD" "$CLONE" \
  psql -U postgres -d postgres -X -At -c \
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name" \
  > "$PLAN_DIR/clone-tables.txt"

docker exec -e PGPASSWORD="$CLONE_PASSWORD" "$CLONE" \
  psql -U postgres -d postgres -X -At -F '|' -c \
  "select table_name,column_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position" \
  > "$PLAN_DIR/clone-columns.txt"

docker exec -e PGPASSWORD="$CLONE_PASSWORD" "$CLONE" \
  psql -U postgres -d postgres -X -At -F '|' -c \
  "select p.tablename,p.policyname,p.cmd,array_to_string(p.roles,','),coalesce(p.qual,''),coalesce(p.with_check,'') from pg_policies p where p.schemaname='public' and exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p.tablename and c.column_name='organization_id') order by p.tablename,p.policyname" \
  > "$PLAN_DIR/clone-policies.txt"

python3 - "$CONTRACT" "$PLAN_DIR" <<'PY'
from pathlib import Path
import json
import re
import sys

contract = Path(sys.argv[1])
plan = Path(sys.argv[2])
lines = contract.read_text(encoding="utf-8", errors="replace").splitlines()

expected_tables = set()
expected_columns = set()
in_tables = False
current = None
in_row = False

for line in lines:
    if line.strip() == "Tables: {":
        in_tables = True
        continue
    if not in_tables:
        continue
    if line.startswith("    Views:"):
        break
    m = re.match(r"^      ([A-Za-z0-9_]+): \{$", line)
    if m:
        current = m.group(1)
        expected_tables.add(current)
        in_row = False
        continue
    if current and line == "        Row: {":
        in_row = True
        continue
    if in_row:
        if line == "        }":
            in_row = False
            continue
        m = re.match(r"^          ([A-Za-z0-9_]+): ", line)
        if m:
            expected_columns.add((current, m.group(1)))

actual_tables = {
    x.strip()
    for x in (plan / "clone-tables.txt").read_text().splitlines()
    if x.strip()
}
actual_columns = set()
for raw in (plan / "clone-columns.txt").read_text().splitlines():
    parts = raw.split("|", 1)
    if len(parts) == 2:
        actual_columns.add((parts[0], parts[1]))

missing_tables = sorted(expected_tables - actual_tables)
missing_columns = sorted(expected_columns - actual_columns)

hard = []
warnings = []
for raw in (plan / "clone-policies.txt").read_text().splitlines():
    parts = raw.split("|", 5)
    if len(parts) != 6:
        continue
    table, policy, cmd, roles, qual, check = parts
    if not any(r in roles.lower() for r in ("authenticated", "anon", "public")):
        continue
    for expr in (qual, check):
        if not expr.strip():
            continue
        compact = re.sub(r"\s+", " ", expr.lower()).strip("() ")
        if compact in {"true", "'true'::boolean"}:
            hard.append(f"{table}|{policy}|{cmd}|unconditional_true")
        global_admin = "has_role" in compact and "'admin'" in compact
        org_guard = any(
            token in compact
            for token in (
                "admin_can_access_org",
                "has_role_in_org",
                "user_belongs_to_org",
                "get_user_organization_id",
                "organization_id",
            )
        )
        if global_admin and not org_guard:
            warnings.append(f"{table}|{policy}|{cmd}|global_admin_without_org_guard")

result = {
    "expected_tables": len(expected_tables),
    "clone_tables": len(actual_tables),
    "missing_tables": missing_tables,
    "expected_columns": len(expected_columns),
    "clone_columns": len(actual_columns),
    "missing_columns": [{"table": t, "column": c} for t, c in missing_columns],
    "rls_hard_failures": sorted(set(hard)),
    "rls_warnings": sorted(set(warnings)),
}

(plan / "contract-result.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print(f"EXPECTED_TABLES={result['expected_tables']}")
print(f"CLONE_TABLES={result['clone_tables']}")
print(f"MISSING_TABLES={len(missing_tables)}")
print(f"EXPECTED_COLUMNS={result['expected_columns']}")
print(f"CLONE_COLUMNS={result['clone_columns']}")
print(f"MISSING_COLUMNS={len(missing_columns)}")
print(f"RLS_HARD_FAILURES={len(set(hard))}")
print(f"RLS_WARNINGS={len(set(warnings))}")

if missing_tables or missing_columns or hard or warnings:
    raise SystemExit("KFAAH_SCHEMA_CLONE_PLAN=FAIL")

print("KFAAH_SCHEMA_CLONE_PLAN=PASS")
PY

python3 - "$PLAN_DIR" "$db_image" <<'PY'
from pathlib import Path
import json
import sys

plan = Path(sys.argv[1])
image = sys.argv[2]

def read(name):
    p = plan / name
    return p.read_text(encoding="utf-8", errors="replace").strip() if p.exists() else ""

def lines(name):
    p = plan / name
    if not p.exists():
        return []
    return [x for x in p.read_text(encoding="utf-8", errors="replace").splitlines() if x]

manifest = {
    "status": "success",
    "created_at_utc": plan.name,
    "db_image": image,
    "live_dump_sha256": read("live-dump.sha256"),
    "live_schema_sha256": read("live-schema.sha256"),
    "contract_sha256": read("contract.sha256"),
    "live_migration_versions": lines("live-versions.txt"),
    "missing_migrations": lines("missing-migrations.txt"),
    "applied_to_clone": lines("applied-to-clone.txt"),
    "contract_result": json.loads(read("contract-result.json")),
}
(plan / "plan-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
PY

chmod -R go-rwx "$PLAN_DIR" || true
note "Clone plan passed. Live production database was not modified."
echo "KFAAH_SCHEMA_PLAN_DIR=$PLAN_DIR"
echo "KFAAH_SCHEMA_PLAN_MANIFEST=$PLAN_DIR/plan-manifest.json"
