#!/usr/bin/env python3
"""Static contract/security audit for Kfaah Supabase Edge Functions.

This script never reads secret values. It classifies functions that use the
service-role key and highlights which ones rely on the Edge Runtime's JWT gate
instead of performing an internal caller check.

It is intentionally conservative: "runtime-gated" is not a source bug by
itself, but those functions MUST NOT be exposed through a gateway that skips
JWT verification (such as the temporary Python functions gateway discovered
during the Hetzner migration audit).
"""
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
FUNCTIONS = ROOT / "supabase" / "functions"
CONFIG = ROOT / "supabase" / "config.toml"

PUBLIC_CONFIG = set()
if CONFIG.exists():
    cfg = CONFIG.read_text(encoding="utf-8", errors="replace")
    current = None
    for raw in cfg.splitlines():
        line = raw.strip()
        m = re.match(r"\[functions\.([A-Za-z0-9_-]+)\]", line)
        if m:
            current = m.group(1)
            continue
        if current and re.match(r"verify_jwt\s*=\s*false\b", line, re.I):
            PUBLIC_CONFIG.add(current)

INTERNAL_AUTH_MARKERS = (
    'req.headers.get("Authorization")',
    "req.headers.get('Authorization')",
    'req.headers.get("authorization")',
    "req.headers.get('authorization')",
    ".auth.getUser(",
    ".auth.getClaims(",
    "getAuthenticatedUser(",
    "verifyCaller(",
    "verifyAuth(",
    "verifyUser(",
    "requireAuthenticatedUser(",
    "requireTrustedCaller(",
    "requireOrganizationAccess(",
    "requirePlatformAdmin(",
    "isServiceRoleRequest(",
)

NON_JWT_SECRET_MARKERS = (
    "KFAAH_EMAIL_WEBHOOK_SECRET",
    "KFAAH_EMAIL_API_KEY",
    "x-webhook-secret",
    "webhook-secret",
    "x-api-key",
    "timingSafeEqual",
    "timing_safe",
    "HMAC",
)


# Public functions that intentionally use service-role access must satisfy a
# function-specific source contract. This turns a manual recovery note into a
# failing CI invariant: if a safety check is later removed, the function falls
# back to PUBLIC-config-needs-review and CI fails.
CONSTRAINED_PUBLIC_CONTRACTS = {
    "org-self-signup": (
        "allow_self_signup",
        "signInWithPassword",
        'approval_status: "pending"',
        'is_default: false',
        "createdNewUser",
        "deleteUser",
        "password.length < 8",
        "consume_public_rate_limit",
        "_max_attempts: 8",
        "_window_seconds: 900",
    ),
    "handle-email-unsubscribe": (
        "email_unsubscribe_tokens",
        "suppressed_emails",
        "used_at",
        "is('used_at', null)",
        r"^[a-f0-9]{64}$",
        "Invalid or expired token",
    ),
}

rows = []
for index in sorted(FUNCTIONS.glob("*/index.ts")):
    name = index.parent.name
    text = index.read_text(encoding="utf-8", errors="replace")
    uses_service = "SUPABASE_SERVICE_ROLE_KEY" in text
    if not uses_service:
        continue
    internal_auth = any(marker in text for marker in INTERNAL_AUTH_MARKERS)
    secret_guard = any(marker in text for marker in NON_JWT_SECRET_MARKERS)
    config_public = name in PUBLIC_CONFIG
    public_contract = CONSTRAINED_PUBLIC_CONTRACTS.get(name)
    constrained_public = bool(
        config_public
        and public_contract
        and all(marker in text for marker in public_contract)
    )

    if internal_auth:
        classification = "internal-auth"
    elif secret_guard:
        classification = "secret/webhook-guard"
    elif constrained_public:
        classification = "constrained-public-flow"
    elif config_public:
        classification = "PUBLIC-config-needs-review"
    else:
        classification = "RUNTIME-JWT-DEPENDENT"

    rows.append((name, classification, config_public))

print("KFAAH EDGE FUNCTION AUTH CONTRACT AUDIT")
print("=" * 72)
for name, classification, config_public in rows:
    print(f"{name:36} {classification:28} verify_jwt_false={str(config_public).lower()}")

runtime_dependent = [r[0] for r in rows if r[1] == "RUNTIME-JWT-DEPENDENT"]
public_review = [r[0] for r in rows if r[1] == "PUBLIC-config-needs-review"]
constrained_public = [r[0] for r in rows if r[1] == "constrained-public-flow"]

print()
print(f"service-role functions: {len(rows)}")
print(f"runtime JWT dependent: {len(runtime_dependent)}")
print(f"constrained public flows: {len(constrained_public)}")
print(f"public config needing explicit review: {len(public_review)}")

if runtime_dependent:
    print("\nRUNTIME-JWT-DEPENDENT")
    for name in runtime_dependent:
        print(f"- {name}")
    print(
        "\nThese functions are safe only when the serving runtime verifies caller JWTs "
        "before invocation. Do not expose them through a permissive custom gateway."
    )

if public_review:
    print("\nPUBLIC CONFIG NEEDING REVIEW")
    for name in public_review:
        print(f"- {name}")
    print(
        "\nThese functions are explicitly configured with verify_jwt=false and use "
        "service-role access without an obvious internal Authorization check. Verify "
        "that each has a webhook secret, signed payload, or tightly constrained public flow."
    )

if public_review:
    raise SystemExit(
        "One or more public service-role functions lack a reviewed constrained-flow contract"
    )

sys.exit(0)
