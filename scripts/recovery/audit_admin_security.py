#!/usr/bin/env python3
"""Static guardrails for Kfaah system-admin and organization authorization."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
errors: list[str] = []

app = (ROOT / "src/App.tsx").read_text(encoding="utf-8", errors="replace")
sensitive_routes = {
    "/inbox",
    "/platform-mail",
    "/internal-inbox",
}
for line_no, line in enumerate(app.splitlines(), start=1):
    is_admin_route = 'path="/admin' in line
    is_sensitive_route = any(f'path="{route}"' in line for route in sensitive_routes)
    if not (is_admin_route or is_sensitive_route):
        continue
    if "<SuperAdminRoute>" not in line:
        errors.append(
            f"src/App.tsx:{line_no}: privileged route is not guarded by SuperAdminRoute"
        )

# Browser code may read user_roles, but role writes must go through reviewed
# RPC/Edge Function paths so organization scope cannot be bypassed.
write_pattern = re.compile(
    r"""\.from\(\s*["']user_roles["']\s*\)
        (?:(?!;).){0,1400}?
        \.(insert|upsert|update|delete)\s*\(""",
    re.S | re.X,
)
for path in sorted((ROOT / "src").rglob("*")):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    for match in write_pattern.finditer(text):
        line_no = text.count("\n", 0, match.start()) + 1
        errors.append(
            f"{path.relative_to(ROOT)}:{line_no}: direct browser user_roles "
            f"{match.group(1)} is forbidden; use the scoped RPC"
        )

impersonate = (
    ROOT / "supabase/functions/impersonate-user/index.ts"
).read_text(encoding="utf-8", errors="replace")
if re.search(r"\baction_link\s*:", impersonate):
    errors.append(
        "impersonate-user returns action_link; expose only the one-time token hash"
    )
if "cannot_impersonate_super_admin" not in impersonate:
    errors.append("impersonate-user must refuse super-admin targets")

create_employee = (
    ROOT / "supabase/functions/create-employee/index.ts"
).read_text(encoding="utf-8", errors="replace")
for required in (
    "organizationId",
    "user_organizations",
    "organization_id",
    "approval_status",
):
    if required not in create_employee:
        errors.append(f"create-employee is missing required org contract: {required}")

if errors:
    print("KFAAH_ADMIN_SECURITY_AUDIT=FAIL")
    for error in errors:
        print("ERROR|" + error)
    sys.exit(1)

print("KFAAH_ADMIN_SECURITY_AUDIT=PASS")
