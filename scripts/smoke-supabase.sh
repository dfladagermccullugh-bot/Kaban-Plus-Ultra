#!/usr/bin/env bash
# Kaban Plus Ultra — headless Supabase smoke probe.
#
# Verifies a connected Supabase project against the invariants Kaban relies on:
#   1. /setup gate state — `profiles` is empty (gate open) vs. populated (closed).
#   2. Trigger-only functions (`on_auth_user_created`, `on_auth_user_email_updated`)
#      are NOT callable as `/rest/v1/rpc/*` from anon — PostgREST returns 403
#      "permission denied for function" once EXECUTE is revoked (see migration
#      0007).
#   3. Share-token RPCs (`rotate_share_token`, `revoke_share_token`) are NOT
#      callable from anon (authenticated bearer required).
#
# Reads `apps/web/.env.local`. Requires NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. The service-role
# key only reads `profiles` (count); no writes are performed.
#
# Must run from a host with outbound HTTPS to the Supabase project. The CI
# harness blocks the destination — the script detects that case and exits 2.
#
# Exit codes:
#   0  all probes pass
#   1  at least one probe failed
#   2  prerequisites missing (env not set, sandbox blocks outbound HTTPS)
#
# Usage:
#   bash scripts/smoke-supabase.sh

set -euo pipefail

ENV_FILE="apps/web/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "::error::missing $ENV_FILE — run the connector regen step from CLAUDE.md" >&2
  exit 2
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL not set in $ENV_FILE}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY not set in $ENV_FILE}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set — ask the operator}"

URL="${NEXT_PUBLIC_SUPABASE_URL%/}"
ANON="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
SR="$SUPABASE_SERVICE_ROLE_KEY"

pass=0
fail=0

# Sandbox / proxy preflight. If outbound HTTPS to Supabase is blocked, every
# probe will fake-403; bail with a clear message instead of producing
# misleading output.
preflight="$(curl -sS -o /dev/null -D - -w '%{http_code}\n' \
  "$URL/rest/v1/" 2>&1 || true)"
if printf '%s' "$preflight" | grep -qi 'x-deny-reason: *host_not_allowed'; then
  echo "::error::outbound HTTPS to $URL is blocked by the local network/proxy" >&2
  echo "         (saw x-deny-reason: host_not_allowed)" >&2
  echo "         run this script from a host with direct internet access." >&2
  exit 2
fi

probe() {
  local label="$1"; shift
  local expected="$1"; shift
  local actual
  actual="$("$@")"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS  $label  ($actual)"
    pass=$((pass + 1))
  else
    echo "FAIL  $label  expected=$expected actual=$actual"
    fail=$((fail + 1))
  fi
}

anon_rpc_status() {
  curl -sS -o /dev/null -w '%{http_code}' \
    -X POST \
    -H "apikey: $ANON" \
    -H "Authorization: Bearer $ANON" \
    -H 'Content-Type: application/json' \
    --data '{}' \
    "$URL/rest/v1/rpc/$1"
}

service_role_count() {
  # GET with Prefer: count=exact + Range: 0-0 → 206 with `Content-Range: 0-0/N`.
  curl -sS -D - -o /dev/null \
    -H "apikey: $SR" \
    -H "Authorization: Bearer $SR" \
    -H 'Prefer: count=exact' \
    -H 'Range: 0-0' \
    "$URL/rest/v1/$1?select=id" \
    | awk 'BEGIN{IGNORECASE=1} /^content-range:/ { split($2, a, "/"); gsub(/[\r\n]/, "", a[2]); print a[2] }'
}

echo "── Kaban Plus Ultra — Supabase smoke ──"
echo "URL:        $URL"
echo

# 1. /setup gate state.
profile_count="$(service_role_count profiles)"
if [[ -z "$profile_count" ]]; then
  echo "WARN  setup-gate state  (could not read content-range from /rest/v1/profiles)"
elif [[ "$profile_count" == "0" ]]; then
  echo "PASS  setup-gate state  (profiles=0 → /setup gate OPEN)"
  pass=$((pass + 1))
else
  echo "INFO  setup-gate state  (profiles=$profile_count → /setup gate CLOSED — expected once an admin has claimed)"
fi

# 2. Anon must NOT be able to RPC the trigger functions. PostgREST returns 403
# "permission denied for function" once EXECUTE is revoked from anon. A 200
# would be a hard regression.
for fn in on_auth_user_created on_auth_user_email_updated; do
  probe "anon RPC denied: $fn" "403" anon_rpc_status "$fn"
done

# 3. Anon must NOT be able to RPC the share-token RPCs (authenticated bearer
# required). Same 403 expectation as the trigger functions.
for fn in rotate_share_token revoke_share_token; do
  probe "anon RPC denied: $fn" "403" anon_rpc_status "$fn"
done

echo
echo "── summary ──"
echo "pass: $pass"
echo "fail: $fail"

if [[ $fail -gt 0 ]]; then
  exit 1
fi
