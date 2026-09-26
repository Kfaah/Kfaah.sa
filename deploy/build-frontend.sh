#!/usr/bin/env bash
set -euo pipefail

# Vite embeds these public values into the browser bundle during the build.
: "${VITE_SUPABASE_URL:?Set the Hetzner Supabase gateway URL before building}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?Set the public anon/publishable key before building}"

case "$VITE_SUPABASE_URL" in
  https://*) ;;
  *) echo "The Supabase gateway URL must use HTTPS." >&2; exit 1 ;;
esac

if [[ ${KFAAH_DEPLOY_TARGET:-} == production && $VITE_SUPABASE_URL == *.supabase.co* ]]; then
  echo "Production must point to the Hetzner gateway, not the former hosted Supabase project." >&2
  exit 1
fi

if [[ -n ${KFAAH_EXPECTED_API_URL:-} && $VITE_SUPABASE_URL != "$KFAAH_EXPECTED_API_URL" ]]; then
  echo "The build API URL differs from the expected deployment URL." >&2
  exit 1
fi

npm ci
npm run build

if ! grep -Fq "$VITE_SUPABASE_URL" dist/index.html; then
  echo "The built page does not contain the selected Supabase gateway URL." >&2
  exit 1
fi

if grep -Fq '%VITE_SUPABASE_URL%' dist/index.html; then
  echo "Vite did not replace the API URL placeholder in index.html." >&2
  exit 1
fi

if grep -R -Fq '.supabase.co' dist; then
  echo "The built frontend still contains a former hosted Supabase endpoint." >&2
  exit 1
fi

echo "Frontend build complete. Review dist/ and deploy it only after preview checks."
