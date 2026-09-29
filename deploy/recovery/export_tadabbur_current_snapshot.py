#!/usr/bin/env python3
"""Export a minimal read-only current snapshot for Tadabbur reconciliation."""

from __future__ import annotations
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ORG_ID = "00a528ce-e836-4ebd-9a50-35aeaa766501"
SUPABASE_ROOT = Path(
    os.environ.get("KFAAH_SUPABASE_ROOT", "/opt/kfaah/production/supabase")
).resolve()
SCOPE_PATH = os.environ.get("TADABBUR_TRUSTED_SCOPE")
STAMP = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
DEFAULT_OUT = Path(
    "/var/lib/kfaah-recovery/tadabbur/current-snapshot-" + STAMP + ".json"
)
OUTPUT = Path(os.environ.get("OUTPUT_PATH", str(DEFAULT_OUT))).resolve()
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

COMPOSITES = {
    "user_organizations": ["user_id", "organization_id"],
    "user_roles": ["user_id", "role"],
    "role_permissions": ["organization_id", "role", "module"],
    "organization_profiles": ["organization_id"],
    "organization_branding": ["organization_id"],
    "organization_settings": ["organization_id"],
    "profiles": ["user_id"],
}

def die(message: str) -> None:
    print("ERROR: " + message, file=sys.stderr)
    raise SystemExit(1)

def note(message: str) -> None:
    print("INFO: " + message)

if os.geteuid() != 0:
    die("root is required for direct read-only access to the local DB container")
if not SCOPE_PATH:
    die("TADABBUR_TRUSTED_SCOPE is required")

scope_path = Path(SCOPE_PATH).resolve()
if not scope_path.is_file():
    die("trusted scope file not found: " + str(scope_path))
if not SUPABASE_ROOT.is_dir():
    die("Supabase root not found: " + str(SUPABASE_ROOT))

try:
    scope = json.loads(scope_path.read_text(encoding="utf-8"))
except Exception as exc:
    die("trusted scope is not valid JSON: " + str(exc))

if scope.get("organization_id") != ORG_ID:
    die("trusted scope organization_id is not Tadabbur")
public_tables = scope.get("public_tables")
if not isinstance(public_tables, dict):
    die("trusted scope has no public_tables object")

def run(cmd: list[str], *, cwd: Path | None = None, stdin: str | None = None) -> str:
    proc = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        input=stdin,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        die("command failed: " + " ".join(cmd[:4]) + "\n" + proc.stderr[-1500:])
    return proc.stdout.strip()

compose = ["docker", "compose"]
if subprocess.run(
    compose + ["version"],
    cwd=str(SUPABASE_ROOT),
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
).returncode != 0:
    if subprocess.run(
        ["docker-compose", "version"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode != 0:
        die("Docker Compose is unavailable")
    compose = ["docker-compose"]

db_container = run(compose + ["ps", "-q", "db"], cwd=SUPABASE_ROOT)
if not db_container:
    die("database container was not found")

def db_query(sql: str) -> str:
    shell = (
        'export PGPASSWORD="\${POSTGRES_PASSWORD:-}"; '
        'exec psql -U "\${POSTGRES_USER:-postgres}" '
        '-d "\${POSTGRES_DB:-postgres}" -X -At -v ON_ERROR_STOP=1'
    )
    return run(
        ["docker", "exec", "-i", db_container, "sh", "-lc", shell],
        stdin=sql,
    )

def qident(value: str) -> str:
    if not IDENT.fullmatch(value):
        die("unsafe SQL identifier in trusted scope: " + value)
    return '"' + value + '"'

def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    return "'" + str(value).replace("'", "''") + "'"

def key_predicate(table: str, row: dict) -> str | None:
    if row.get("id") is not None:
        return qident("id") + " = " + literal(row["id"])
    fields = COMPOSITES.get(table)
    if not fields or not all(field in row for field in fields):
        return None
    clauses = []
    for field in fields:
        col = qident(field)
        value = row.get(field)
        clauses.append(col + " IS NULL" if value is None else col + " = " + literal(value))
    return "(" + " AND ".join(clauses) + ")"

snapshot_tables: dict[str, object] = {}
queried_rows = 0
unkeyed_rows = 0

for table in sorted(public_tables):
    if not IDENT.fullmatch(table):
        die("unsafe table name in trusted scope: " + table)
    entries = public_tables.get(table)
    if not isinstance(entries, list):
        continue

    predicates = []
    for item in entries:
        row = item.get("row") if isinstance(item, dict) else None
        if not isinstance(row, dict):
            continue
        predicate = key_predicate(table, row)
        if predicate:
            predicates.append(predicate)
        else:
            unkeyed_rows += 1

    if not predicates:
        snapshot_tables[table] = []
        continue

    current_rows = []
    for start in range(0, len(predicates), 150):
        chunk = predicates[start:start + 150]
        sql = (
            "SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)::text "
            "FROM public." + qident(table) + " AS t WHERE "
            + " OR ".join(chunk) + ";\n"
        )
        data = json.loads(db_query(sql) or "[]")
        if not isinstance(data, list):
            die("unexpected JSON result for table " + table)
        current_rows.extend(data)

    dedup = {}
    for row in current_rows:
        key = json.dumps(row, sort_keys=True, ensure_ascii=False)
        dedup[key] = row
    snapshot_tables[table] = list(dedup.values())
    queried_rows += len(snapshot_tables[table])

auth_block = scope.get("auth_redacted") or {}
trusted_auth_users = auth_block.get("users") if isinstance(auth_block, dict) else []
auth_user_ids = sorted({
    str(item.get("id"))
    for item in trusted_auth_users or []
    if isinstance(item, dict) and item.get("id")
})

if auth_user_ids:
    ids_sql = ",".join(literal(x) for x in auth_user_ids)
    auth_sql = (
        "SELECT jsonb_build_object("
        "'users', COALESCE((SELECT jsonb_agg(jsonb_build_object("
        "'id', id, 'created_at', created_at)) FROM auth.users "
        "WHERE id IN (" + ids_sql + ")), '[]'::jsonb),"
        "'identities', COALESCE((SELECT jsonb_agg(jsonb_build_object("
        "'id', id, 'user_id', user_id, 'provider', provider, 'created_at', created_at)) "
        "FROM auth.identities WHERE user_id IN (" + ids_sql + ")), '[]'::jsonb),"
        "'mfa_factors', COALESCE((SELECT jsonb_agg(jsonb_build_object("
        "'id', id, 'user_id', user_id, 'created_at', created_at)) "
        "FROM auth.mfa_factors WHERE user_id IN (" + ids_sql + ")), '[]'::jsonb)"
        ")::text;\n"
    )
    auth_current = json.loads(db_query(auth_sql) or "{}")
else:
    auth_current = {"users": [], "identities": [], "mfa_factors": []}

snapshot_tables["__auth__"] = [auth_current]

storage_objects = scope.get("storage_objects")
storage_objects = storage_objects if isinstance(storage_objects, list) else []
storage_predicates = []
for item in storage_objects:
    if not isinstance(item, dict):
        continue
    bucket = item.get("bucket_id")
    name = item.get("name")
    if bucket and name:
        storage_predicates.append(
            "(bucket_id = " + literal(bucket) + " AND name = " + literal(name) + ")"
        )

current_objects = []
for start in range(0, len(storage_predicates), 150):
    chunk = storage_predicates[start:start + 150]
    if not chunk:
        continue
    sql = (
        "SELECT COALESCE(jsonb_agg(jsonb_build_object("
        "'id', id, 'bucket_id', bucket_id, 'name', name, "
        "'created_at', created_at, 'updated_at', updated_at, 'metadata', metadata"
        ")), '[]'::jsonb)::text "
        "FROM storage.objects WHERE " + " OR ".join(chunk) + ";\n"
    )
    data = json.loads(db_query(sql) or "[]")
    if isinstance(data, list):
        current_objects.extend(data)

snapshot_tables["__storage_metadata__"] = [
    {"buckets": [], "objects": current_objects}
]

doc = {
    "tool": "export-tadabbur-current-snapshot",
    "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    "organization_id": ORG_ID,
    "trusted_scope_source": str(scope_path),
    "tables": snapshot_tables,
    "stats": {
        "public_tables_queried": len([k for k in snapshot_tables if not k.startswith("__")]),
        "public_rows_returned": queried_rows,
        "trusted_rows_without_stable_key": unkeyed_rows,
        "auth_users_checked": len(auth_user_ids),
        "storage_objects_checked": len(storage_objects),
        "storage_objects_found": len(current_objects),
    },
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
os.chown(OUTPUT, 0, 0)
os.chmod(OUTPUT, 0o600)

note("snapshot_path=" + str(OUTPUT))
note("public_rows_returned=" + str(queried_rows))
note("auth_users_checked=" + str(len(auth_user_ids)))
note("storage_objects_found=" + str(len(current_objects)))
print("TADABBUR_CURRENT_SNAPSHOT=READY")
