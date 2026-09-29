#!/usr/bin/env bash
set -euo pipefail

# Find a private RSA key that matches the trusted pre-cutover Kfaah backup.
# Safe output: path + SHA-256 public-key fingerprint only. Never prints key data.

EXPECTED="${KFAAH_TRUSTED_BACKUP_FINGERPRINT:-fa7e02da0a4f6c41da30383b3af1861f67168a0f1548ad6c4eb4495c78496570}"

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: root required to inspect protected key locations" >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  echo "ERROR: openssl unavailable" >&2
  exit 1
}

candidates=(
  "/root/.secrets/kfaah-backup-private.pem"
  "/home/deploy/.secrets/kfaah-backup-private.pem"
  "/opt/kfaah/backup-keys/kfaah-backup-private.pem"
  "/opt/kfaah/backup-keys/backup-private.pem"
  "/opt/kfaah/.secrets/kfaah-backup-private.pem"
)

found=0
match=0

fingerprint() {
  local key="$1"
  openssl pkey -in "$key" -pubout -outform DER 2>/dev/null     | sha256sum | awk '{print $1}'
}

echo "KFAAH_TRUSTED_BACKUP_KEY_AUDIT"
echo "expected_fingerprint=$EXPECTED"

for key in "${candidates[@]}"; do
  [[ -r "$key" ]] || continue
  found=$((found+1))

  fp="$(fingerprint "$key" || true)"
  if [[ ! "$fp" =~ ^[a-f0-9]{64}$ ]]; then
    echo "INVALID_KEY|$key"
    continue
  fi

  if [[ "$fp" == "$EXPECTED" ]]; then
    echo "MATCH|$key|$fp"
    match=$((match+1))
  else
    echo "MISMATCH|$key|$fp"
  fi
done

echo "SUMMARY|candidates_readable=$found|matches=$match"

if [[ "$match" -eq 1 ]]; then
  echo "KFAAH_TRUSTED_BACKUP_KEY=READY"
  exit 0
fi

if [[ "$match" -gt 1 ]]; then
  echo "ERROR: multiple matching keys found; operator review required" >&2
  exit 2
fi

echo "KFAAH_TRUSTED_BACKUP_KEY=NOT_FOUND"
exit 3
