#!/usr/bin/env bash
# Fetch the upstream supabase/supabase self-host stack at the tag pinned in
# ./PIN and unpack its `docker/` subtree into ./upstream/. Idempotent: if
# ./upstream/.fetched-ref already matches PIN, this is a no-op.
#
# Why a fetch script instead of vendoring the file: the upstream compose
# references ./volumes/db/*.sql, ./volumes/api/kong.yml, etc. — bind-mounts
# into 30+ files. Vendoring would mean forking the whole tree, drifting from
# upstream, and re-pinning each Supabase service image by hand. A pinned tag
# + tarball fetch is reproducible, auditable, and trivial to bump.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REF="$(tr -d '[:space:]' < "$HERE/PIN")"
DEST="$HERE/upstream"
MARKER="$DEST/.fetched-ref"

if [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$REF" ]; then
  echo "[supabase] upstream already at $REF (skip)"
  exit 0
fi

echo "[supabase] fetching supabase/supabase@$REF docker/ subtree …"
rm -rf "$DEST"
mkdir -p "$DEST"

# GitHub archive tarballs name the top-level directory after the tag with
# the leading 'v' stripped: supabase-1.24.09/…
STRIP_REF="${REF#v}"
URL="https://github.com/supabase/supabase/archive/refs/tags/${REF}.tar.gz"

if ! curl -fsSL "$URL" \
   | tar -xz -C "$DEST" --strip-components=1 \
       "supabase-${STRIP_REF}/docker"; then
  echo "[supabase] fetch failed — check network and that the tag exists at $URL" >&2
  rm -rf "$DEST"
  exit 1
fi

if [ ! -f "$DEST/docker/docker-compose.yml" ]; then
  echo "[supabase] tarball extracted but docker/docker-compose.yml missing" >&2
  exit 1
fi

echo "$REF" > "$MARKER"
echo "[supabase] pinned at $REF -> $DEST/docker/"
