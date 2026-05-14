# 0020. Revoke RPC grants from trigger-only and admin-only SECURITY DEFINER functions

- **Date**: 2026-05-14
- **Status**: accepted

## Context

A Supabase security-advisor pass against the live project
(`xqdhpxfgrckjzzbenivp`) flagged twelve `SECURITY DEFINER` function-exposure
lints (lint codes `0028` + `0029`) across six functions in the `public`
schema. Postgres' default-PUBLIC `EXECUTE` grant meant every one of them was
reachable via `/rest/v1/rpc/<name>` from either the `anon` or
`authenticated` role:

| Function | How it's actually called | Was reachable as RPC by |
| --- | --- | --- |
| `on_auth_user_created()` | trigger on `auth.users` (insert) | anon, authenticated |
| `on_auth_user_email_updated()` | trigger on `auth.users` (update) | anon, authenticated |
| `rotate_share_token(uuid)` | server action under an authenticated cookie | anon, authenticated |
| `revoke_share_token(uuid)` | server action under an authenticated cookie | anon, authenticated |
| `has_board_access(uuid, text)` | inline in RLS policies | anon, authenticated |
| `has_share_access(uuid)` | inline in RLS policies | anon, authenticated |

The trigger functions are never meant to be invoked through PostgREST; their
bodies expect `NEW`/`OLD` records and a real trigger context, so a direct RPC
call would error out, but they don't belong in the RPC surface area at all.
The share-token RPCs are explicitly meant for authenticated server actions
— `anon` doesn't need them. The two `has_*_access` helpers are evaluated
inline inside `using ()` clauses on every protected table and must stay
reachable by both `anon` (for share-token reads) and `authenticated`.

## Decision

Lock down four of the six functions in migration `0007_revoke_rpc_grants.sql`
(plus a follow-up `0008_restore_auth_trigger_grants.sql` for one specific
breakage uncovered during verification):

- **`on_auth_user_created()`** + **`on_auth_user_email_updated()`**: revoke
  `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`. They keep `postgres`,
  `service_role`, and `supabase_auth_admin` (re-granted in 0008 because
  revoking from `PUBLIC` cascaded to the auth-admin role that fires the
  triggers).
- **`rotate_share_token(uuid)`** + **`revoke_share_token(uuid)`**: revoke
  `EXECUTE` from `PUBLIC` and `anon`. They keep `authenticated` (already
  granted explicitly in migration 0005), plus `postgres` and `service_role`.

Leave **`has_board_access(uuid, text)`** and **`has_share_access(uuid)`**
unchanged — RLS policies must be able to call them for every role that
queries the protected tables, including `anon` for share-token reads. The
corresponding advisor lints for these two helpers are accepted as a
known-good exposure: the functions return a boolean and take a board id, so
an attacker can at best confirm or deny existence of a board id they already
have (no oracle on the listing).

Add `scripts/smoke-supabase.sh` so an operator on a dev machine can probe
the revoked grants live (PostgREST returns `403 permission denied for
function` once `EXECUTE` is revoked from a role). The script auto-detects a
blocked outbound path (e.g. inside the CI harness) and exits 2 rather than
producing misleading 403s from the network proxy.

## Alternatives considered

- **Move the trigger functions and `has_*_access` helpers to a `private`
  schema not exposed by PostgREST.** Cleaner long-term and what the advisor
  remediation page recommends. Rejected for this session because (a) every
  RLS policy in `0001`+`0005` references the helpers by bare name, so the
  move requires either a schema-qualified rewrite or a `search_path` change
  on every dependent policy; (b) trigger function moves invalidate the
  existing triggers and need the triggers re-created in sequence. Both are
  worth doing, but they are a separate refactor — the revoke is the
  high-value tightening that ships today.
- **Switch the functions to `SECURITY INVOKER`.** Rejected because
  `has_board_access` needs `SECURITY DEFINER` to read `boards` and
  `board_collaborators` without each caller needing direct SELECT — those
  are exactly the tables RLS protects.
- **Add an Edge Function shim and route the share-token rotation through
  HTTP instead of an RPC.** Rejected — the existing server action already
  proxies through Supabase Auth cookies, and PostgREST RPC is the cheapest
  path. The `authenticated`-only grant is the right surface; we just need to
  pull `anon` off the default-PUBLIC list.
- **Keep the smoke script in CI.** Rejected — it needs a service-role key
  to read the row counts and is environment-specific (the project ref it
  probes lives in `.env.local`). Manual run on a dev machine is the right
  cadence.

## Consequences

- Twelve advisor lints drop to eight; the remaining eight are documented as
  accepted-by-design (six on `has_*_access` for inline RLS use, two on
  `rotate_share_token` + `revoke_share_token` for the deliberate
  `authenticated` grant). `extension_in_public` (moddatetime) and
  `public_bucket_allows_listing` (avatars) are unrelated cosmetic warnings
  carried over.
- A self-host operator running `psql -f supabase/migrations/0007_*.sql` and
  then `0008_*.sql` gets the same shape on a fresh stack. The two migrations
  intentionally ship as a pair: 0007 alone would brick signups by stripping
  `supabase_auth_admin` of EXECUTE.
- `scripts/smoke-supabase.sh` is the operator's first-time-from-a-dev-machine
  signal-of-life — it verifies setup-gate state + the four revoked RPCs
  return `403`. Detects the CI harness's `host_not_allowed` proxy and exits
  2 cleanly so the failure mode is obvious.
- Future sessions adding new `SECURITY DEFINER` functions should remember
  to either grant `EXECUTE` only to the role that needs it or revoke from
  `PUBLIC` immediately — Postgres's default is wide-open.
