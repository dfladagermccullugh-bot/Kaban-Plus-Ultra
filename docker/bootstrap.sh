#!/usr/bin/env bash
# First-boot bootstrap: wait for the Supabase `db` container to come up
# healthy, then apply every SQL file in supabase/migrations/ via `psql`.
#
# Idempotent: a marker file (`.bootstrap-done` next to this script) skips
# re-application unless `--force` is passed. The Supabase MCC migration
# tracker handles re-runs gracefully too, but we still avoid the round-trip
# on subsequent boots.
#
# Designed to be invoked by `scripts/install-kaban.sh` and by hand.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

# Run from this script's own directory so the default COMPOSE_FILE is a
# bare relative path. An absolute /c/Users/... path gets mangled when it
# reaches the docker daemon on Git Bash for Windows (it prepends a drive
# letter → C:\c\Users\...). A relative path sidesteps that entirely.
# Override COMPOSE_FILE only if your shell doesn't rewrite host paths.
cd "$HERE"

COMPOSE_FILE="${COMPOSE_FILE:-kaban-stack.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO_ROOT/supabase/migrations}"
MARKER="${MARKER:-$HERE/.bootstrap-done}"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-180}"

force=0
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "[bootstrap] unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [ -f "$MARKER" ] && [ "$force" = 0 ]; then
  echo "[bootstrap] already applied ($MARKER); re-run with --force to override."
  exit 0
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[bootstrap] migrations dir not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

# POSTGRES_PASSWORD is exported by the supabase compose's .env; require it.
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set (source docker/.env first)}"

echo "[bootstrap] waiting up to ${HEALTH_TIMEOUT_S}s for '$DB_SERVICE' to be healthy …"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT_S ))
status=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  status=$(docker compose -f "$COMPOSE_FILE" ps --format '{{.Service}}\t{{.Health}}' \
    | awk -v s="$DB_SERVICE" -F'\t' '$1==s {print $2}' \
    || true)
  case "$status" in
    healthy) break ;;
    *) sleep 2 ;;
  esac
done
if [ "$status" != "healthy" ]; then
  echo "[bootstrap] '$DB_SERVICE' never became healthy (last status: '$status')" >&2
  echo "[bootstrap] check 'docker compose -f $COMPOSE_FILE logs $DB_SERVICE'" >&2
  exit 1
fi

echo "[bootstrap] applying migrations from $MIGRATIONS_DIR …"
shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ "${#files[@]}" -eq 0 ]; then
  echo "[bootstrap] no .sql files in $MIGRATIONS_DIR; nothing to do."
  touch "$MARKER"; exit 0
fi

for f in "${files[@]}"; do
  name="$(basename "$f")"
  echo "[bootstrap]   $name"
  # ON_ERROR_STOP=1 so a broken migration fails the whole run rather than
  # silently leaving half-applied schema behind. Each migration file is
  # already idempotent (uses `if not exists` / `or replace`) — re-running
  # against an already-bootstrapped DB is safe.
  docker compose -f "$COMPOSE_FILE" exec -T \
    -e PGPASSWORD="$POSTGRES_PASSWORD" \
    "$DB_SERVICE" psql -U postgres -d postgres \
      -v ON_ERROR_STOP=1 -f - < "$f"
done

touch "$MARKER"
echo "[bootstrap] done. ($MARKER)"
