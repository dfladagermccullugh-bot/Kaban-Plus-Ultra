#!/bin/sh
# Postgres backup loop for the bundled self-host stack.
#
# Bind-mounted into the `db-backup` sidecar service in kaban-stack.yml.
# Runs `pg_dumpall` against the upstream Supabase `db` service on an
# interval, gzips the dump, rotates older files, and touches a marker
# file the container healthcheck looks at.
#
# Environment (all optional, defaults below):
#   BACKUP_INTERVAL_SECONDS   — sleep between dumps (default 86400 = daily)
#   BACKUP_RETENTION_DAYS     — delete dumps older than this many days
#                               (default 14)
#   BACKUP_DIR                — where to write dumps inside the container
#                               (default /backups; bind-mount this)
#   PG{HOST,PORT,USER,PASSWORD,DATABASE} — standard libpq env vars; set
#                               via the compose `environment:` block.

set -eu

: "${BACKUP_INTERVAL_SECONDS:=86400}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_DIR:=/backups}"

mkdir -p "$BACKUP_DIR"

log() { printf '[db-backup] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

log "starting; interval=${BACKUP_INTERVAL_SECONDS}s retention=${BACKUP_RETENTION_DAYS}d dir=$BACKUP_DIR"

# Run one dump immediately so the healthcheck has a fresh marker before
# `start_period` expires.
while :; do
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$BACKUP_DIR/kaban-${ts}.sql.gz"
  log "dumping → $out"

  # `pg_dumpall --clean --if-exists` produces a script that drops then
  # recreates every database, so a restore is `gunzip -c file.sql.gz |
  # psql -U postgres`. Includes globals (roles, tablespaces).
  if pg_dumpall --clean --if-exists | gzip -9 > "${out}.tmp"; then
    mv "${out}.tmp" "$out"
    size=$(wc -c < "$out" | tr -d ' ')
    touch "$BACKUP_DIR/.last-ok"
    log "ok (${size} bytes)"
  else
    rm -f "${out}.tmp"
    log "FAILED — keeping previous .last-ok marker, sidecar healthcheck will flip unhealthy if this persists"
  fi

  # Rotate older dumps. `find -mtime` is GNU find on alpine; +N matches
  # files strictly older than N*24h.
  if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kaban-*.sql.gz' \
      -mtime "+${BACKUP_RETENTION_DAYS}" -delete 2>/dev/null || true
  fi

  sleep "$BACKUP_INTERVAL_SECONDS"
done
