#!/usr/bin/env bash
# Apply all supabase/migrations/*.sql to the linked remote Postgres (requires DB password).
# Usage: export SUPABASE_DB_PASSWORD='...' && ./scripts/apply-supabase-migrations-psql.sh
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Set SUPABASE_DB_PASSWORD (Database password from Supabase Dashboard → Settings → Database)." >&2
  exit 1
fi
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Set SUPABASE_URL in the environment or source .env" >&2
  exit 1
fi
REF="$(python3 - <<'PY'
import os, re
u = os.environ.get("SUPABASE_URL", "")
m = re.match(r"https://([^.]+)\.supabase\.co/?$", u.strip())
print(m.group(1) if m else "")
PY
)"
if [[ -z "$REF" ]]; then
  echo "Could not parse project ref from SUPABASE_URL=$SUPABASE_URL" >&2
  exit 1
fi
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
HOST="db.${REF}.supabase.co"
echo "Applying migrations to $HOST ..."
shopt -s nullglob
for f in supabase/migrations/*.sql; do
  echo "--> $f"
  psql -h "$HOST" -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$f"
done
echo "Done."
