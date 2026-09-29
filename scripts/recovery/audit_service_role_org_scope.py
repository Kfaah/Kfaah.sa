#!/usr/bin/env python3
"""Audit service-role Edge Functions for explicit organization scoping.

This is deliberately conservative. It reports functions that:
- use SUPABASE_SERVICE_ROLE_KEY,
- reference an organization identifier,
- and authenticate a user,
but do not contain an explicit organization-scope guard marker.

The first phase is report-only so existing functions can be reviewed without
creating false-positive CI failures. After the review allowlist is empty, this
script can be switched to fail-closed.
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
FUNCTIONS = ROOT / "supabase" / "functions"

AUTH_MARKERS = (
    'req.headers.get("Authorization")',
    "req.headers.get('Authorization')",
    ".auth.getUser(",
    ".auth.getClaims(",
    "requireAuthenticatedUser(",
    "requireOrganizationAccess(",
    "requirePlatformAdmin(",
)

ORG_REFERENCE = re.compile(
    r"\b(?:organizationId|organization_id|orgId|org_id)\b"
)

SCOPE_MARKERS = (
    "requireOrganizationAccess(",
    "admin_can_access_org",
    "manager_can_access_org",
    "has_role_in_org",
    "has_any_role_in_org",
    "user_belongs_to_org",
    "is_user_approved_in_org",
    'approval_status", "approved"',
    "approval_status",
    '.eq("organization_id"',
    ".eq('organization_id'",
    "organization_id ===",
    "organizationId ===",
)

PUBLIC_OR_SYSTEM_FUNCTIONS = {
    "auth-email-hook",
    "handle-email-suppression",
    "handle-email-unsubscribe",
    "inbound-platform-email",
    "org-self-signup",
    "process-email-queue",
    "secure-backup-to-github",
    "setup-demo",
}

rows = []
suspicious = []

for index in sorted(FUNCTIONS.glob("*/index.ts")):
    name = index.parent.name
    text = index.read_text(encoding="utf-8", errors="replace")
    if "SUPABASE_SERVICE_ROLE_KEY" not in text:
        continue
    if not ORG_REFERENCE.search(text):
        continue

    authenticated = any(marker in text for marker in AUTH_MARKERS)
    scope_markers = [marker for marker in SCOPE_MARKERS if marker in text]
    exempt = name in PUBLIC_OR_SYSTEM_FUNCTIONS

    row = {
        "function": name,
        "authenticated": authenticated,
        "scope_marker_count": len(scope_markers),
        "exempt_public_or_system": exempt,
    }
    rows.append(row)

    if authenticated and not exempt and not scope_markers:
        suspicious.append(row)

print("KFAAH SERVICE-ROLE ORG-SCOPE AUDIT")
print("=" * 72)
for row in rows:
    print(
        f"{row['function']:36} "
        f"auth={str(row['authenticated']).lower():5} "
        f"scope_markers={row['scope_marker_count']:2} "
        f"exempt={str(row['exempt_public_or_system']).lower()}"
    )

print()
print(f"reviewed_functions={len(rows)}")
print(f"suspicious_functions={len(suspicious)}")
for row in suspicious:
    print("SUSPICIOUS|" + row["function"])

Path("/tmp/kfaah-service-role-org-scope.json").write_text(
    json.dumps(
        {"rows": rows, "suspicious": suspicious},
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)

# Report-only until the current codebase has been reviewed function by function.
raise SystemExit(0)
