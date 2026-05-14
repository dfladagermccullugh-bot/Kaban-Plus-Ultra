#!/bin/sh
# Healthcheck for the db-backup sidecar.
#
# Healthy ⇔ `$BACKUP_DIR/.last-ok` exists AND was touched within the last
# 2 × BACKUP_INTERVAL_SECONDS. That tolerates one missed cycle (e.g. the
# `db` service was restarting during a dump attempt) before flipping
# unhealthy and letting Docker / the operator notice.

set -eu

: "${BACKUP_INTERVAL_SECONDS:=86400}"
: "${BACKUP_DIR:=/backups}"

marker="$BACKUP_DIR/.last-ok"
[ -f "$marker" ] || { echo "no $marker yet"; exit 1; }

now=$(date +%s)
last=$(stat -c %Y "$marker" 2>/dev/null || stat -f %m "$marker")
age=$(( now - last ))
threshold=$(( BACKUP_INTERVAL_SECONDS * 2 ))

if [ "$age" -gt "$threshold" ]; then
  echo "last dump ${age}s old (> ${threshold}s)"
  exit 1
fi
echo "last dump ${age}s old"
