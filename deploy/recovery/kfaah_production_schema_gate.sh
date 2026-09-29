#!/usr/bin/env bash
set -euo pipefail

# Production schema acceptance gate for Kfaah self-hosted Supabase.
# Read-only by default. It writes the schema-ready marker only after every
# contract check passes and KFAAH_SCHEMA_GATE_MARK_READY=yes is supplied.

[[ "$EUID" -eq 0 ]] || { echo "ERROR: root required" >&2; exit 1; }

SUPABASE_ROOT="\${KFAAH_SUPABASE_ROOT:-/opt/kfaah/production/supabase}"
STATE_ROOT="\${KFAAH_RECOVERY_STATE_ROOT:-/var/lib/kfaah-recovery}"
CONTRACT="\${KFAAH_SCHEMA_TYPES:-$STATE_ROOT/current-contract/types.ts}"
MARK_READY="\${KFAAH_SCHEMA_GATE_MARK_READY:-no}"
READY_MARKER="$STATE_ROOT/schema-ready"

die() { echo "ERROR: $*" >&2; exit 1; }
note() { echo "==> $*"; }

[[ -r "$CONTRACT" ]] || die "schema contract missing: $CONTRACT"
[[ -d "$SUPABASE_ROOT" ]] || die "Supabase root missing: $SUPABASE_ROOT"

cd "$SUPABASE_ROOT"
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Docker Compose unavailable"
fi

"\${COMPOSE[@]}" config --services | grep -qx db || die "Compose db service missing"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

db_psql() {
  "\${COMPOSE[@]}" exec -T db sh -lc '
    export PGPASSWORD="\${POSTGRES_PASSWORD:-}"
    exec psql -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-postgres}" -X -At -F "|"
  '
}

note "Reading schema catalog from ${DB_NAME_OVERRIDE:-production database}"
db_psql > "$tmp/tables.txt" <<'SQL'
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
SQL

db_psql > "$tmp/columns.txt" <<'SQL'
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
SQL

db_psql > "$tmp/policies.txt" <<'SQL'
select
  p.tablename,
  p.policyname,
  p.cmd,
  array_to_string(p.roles, ','),
  coalesce(p.qual, ''),
  coalesce(p.with_check, '')
from pg_policies p
where p.schemaname = 'public'
  and exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = p.tablename
      and c.column_name = 'organization_id'
  )
order by p.tablename, p.policyname;
SQL

db_psql > "$tmp/functions.txt" <<'SQL'
select p.proname, p.pronargs
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_super_admin',
    'admin_can_access_org',
    'manager_can_access_org',
    'has_role_in_org',
    'consume_public_rate_limit',
    'set_org_member_role'
  )
order by p.proname, p.pronargs;
SQL

contract_sha="$(sha256sum "$CONTRACT" | awk '{print $1}')"

python3 - "$CONTRACT" "$tmp/tables.txt" "$tmp/columns.txt" "$tmp/policies.txt" "$tmp/functions.txt" <<'PY'
from pathlib import Path
import re
import sys

types_path, tables_path, columns_path, policies_path, functions_path = map(Path, sys.argv[1:])

lines = types_path.read_text(encoding="utf-8", errors="replace").splitlines()

expected_tables = set()
expected_columns = set()
in_tables = False
current_table = None
in_row = False

for line in lines:
    if line.strip() == "Tables: {":
        in_tables = True
        continue
    if not in_tables:
        continue
    if line.startswith("    Views:"):
        break

    table_match = re.match(r"^      ([A-Za-z0-9_]+): \{$", line)
    if table_match:
        current_table = table_match.group(1)
        expected_tables.add(current_table)
        in_row = False
        continue

    if current_table and line == "        Row: {":
        in_row = True
        continue

    if in_row:
        if line == "        }":
            in_row = False
            continue
        column_match = re.match(r"^          ([A-Za-z0-9_]+): ", line)
        if column_match:
            expected_columns.add((current_table, column_match.group(1)))

actual_tables = {
    line.strip()
    for line in tables_path.read_text(encoding="utf-8", errors="replace").splitlines()
    if line.strip()
}
actual_columns = set()
for raw in columns_path.read_text(encoding="utf-8", errors="replace").splitlines():
    parts = raw.split("|", 1)
    if len(parts) == 2:
        actual_columns.add((parts[0].strip(), parts[1].strip()))

missing_tables = sorted(expected_tables - actual_tables)
missing_columns = sorted(expected_columns - actual_columns)

print(f"EXPECTED_TABLES={len(expected_tables)}")
print(f"PRODUCTION_TABLES={len(actual_tables)}")
print(f"MISSING_TABLES={len(missing_tables)}")
for item in missing_tables:
    print("MISSING_TABLE|" + item)

print(f"EXPECTED_COLUMNS={len(expected_columns)}")
print(f"PRODUCTION_COLUMNS={len(actual_columns)}")
print(f"MISSING_COLUMNS={len(missing_columns)}")
for table, column in missing_columns:
    print(f"MISSING_COLUMN|{table}|{column}")

hard_failures = []
warnings = []
for raw in policies_path.read_text(encoding="utf-8", errors="replace").splitlines():
    parts = raw.split("|", 5)
    if len(parts) != 6:
        continue
    table, policy, cmd, roles, qual, check = parts
    role_text = roles.lower()
    if not any(role in role_text for role in ("authenticated", "anon", "public")):
        continue
    for expression in (qual, check):
        if not expression.strip():
            continue
        compact = re.sub(r"\s+", " ", expression.lower()).strip("() ")
        if compact in {"true", "'true'::boolean"}:
            hard_failures.append(f"{table}|{policy}|{cmd}|unconditional_true")
        has_global_admin = "has_role" in compact and "'admin'" in compact
        has_org_guard = any(
            token in compact
            for token in (
                "admin_can_access_org",
                "has_role_in_org",
                "user_belongs_to_org",
                "get_user_organization_id",
                "organization_id",
            )
        )
        if has_global_admin and not has_org_guard:
            warnings.append(f"{table}|{policy}|{cmd}|global_admin_without_org_guard")

print(f"RLS_HARD_FAILURES={len(set(hard_failures))}")
for item in sorted(set(hard_failures)):
    print("RLS_FAIL|" + item)
print(f"RLS_WARNINGS={len(set(warnings))}")
for item in sorted(set(warnings)):
    print("RLS_WARN|" + item)

function_rows = set()
for raw in functions_path.read_text(encoding="utf-8", errors="replace").splitlines():
    parts = raw.split("|", 1)
    if len(parts) == 2 and parts[1].isdigit():
        function_rows.add((parts[0], int(parts[1])))

required_functions = {
    ("is_super_admin", 1),
    ("admin_can_access_org", 1),
    ("manager_can_access_org", 1),
    ("has_role_in_org", 3),
    ("consume_public_rate_limit", 4),
    ("set_org_member_role", 3),
}
missing_functions = sorted(required_functions - function_rows)
print(f"MISSING_CRITICAL_FUNCTIONS={len(missing_functions)}")
for name, argc in missing_functions:
    print(f"MISSING_FUNCTION|{name}|argc={argc}")

if missing_tables or missing_columns or hard_failures or warnings or missing_functions:
    raise SystemExit("KFAAH_PRODUCTION_SCHEMA_GATE=FAIL")

print("KFAAH_PRODUCTION_SCHEMA_GATE=PASS")
PY

if [[ "$MARK_READY" == "yes" && -n "$DB_NAME_OVERRIDE" ]]; then
  die "Refusing to mark production schema ready while validating a database override"
fi

if [[ "$MARK_READY" == "yes" ]]; then
  install -d -o root -g root -m 0700 "$STATE_ROOT"
  umask 077
  {
    printf 'contract_sha256=%s\n' "$contract_sha"
    printf 'accepted_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$READY_MARKER"
  chown root:root "$READY_MARKER"
  chmod 0600 "$READY_MARKER"
  note "Production schema accepted; marker written."
else
  note "Schema checks passed; marker not written (read-only mode)."
fi
