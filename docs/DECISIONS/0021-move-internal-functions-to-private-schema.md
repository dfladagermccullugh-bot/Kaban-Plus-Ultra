# 0021. Move internal SECURITY DEFINER functions into a `private` schema

- **Date**: 2026-05-15
- **Status**: accepted — supersedes the "defer schema move" half of ADR 0020.

## Context

ADR 0020 (2026-05-14) revoked `EXECUTE` from `anon` / `authenticated` on the
two trigger functions and two share-token RPCs but explicitly deferred the
schema move that would clear the remaining six advisor lints:

| Function | Why the lint stuck around |
| --- | --- |
| `public.has_board_access(uuid, text)` | DEFINER + reachable as `anon` + `authenticated` (kept callable inline in every RLS policy). |
| `public.has_share_access(uuid)` | Same. |
| `public.rotate_share_token(uuid)` | DEFINER + reachable as `authenticated` (server action calls it). |
| `public.revoke_share_token(uuid)` | Same. |

The advisor (lint codes `0028` + `0029`) fires whenever a SECURITY DEFINER
function lives in a PostgREST-exposed schema and any role can `EXECUTE` it.
Revoke alone could not close the lints — the helpers must be callable by
`anon` for share-token reads to work through RLS, and the share-token RPCs
must be callable by `authenticated`.

## Decision

Migration `0009_private_schema_for_internal_functions.sql` closes the six
lints in two complementary ways:

### A. Move the four "internal" functions into a new `private` schema

PostgREST only exposes schemas listed in `db.api.schemas` (default:
`public`). A function in `private` cannot be reached via
`/rest/v1/rpc/<name>` regardless of `EXECUTE` grants — the advisor stops
flagging it.

- `private.has_board_access(uuid, text)` — SECURITY DEFINER, EXECUTE granted
  to `anon`, `authenticated`, `service_role`. RLS policies in `public` now
  reference it as `private.has_board_access(…)`.
- `private.has_share_access(uuid)` — same shape.
- `private.on_auth_user_created()` + `private.on_auth_user_email_updated()`
  — SECURITY DEFINER, EXECUTE granted only to `supabase_auth_admin`. The
  two `auth.users` triggers were dropped and recreated calling the new
  locations.

Schema `private` itself is `revoke all … from public` then
`grant usage … to anon, authenticated, service_role, supabase_auth_admin`
— USAGE is the minimum required for the RLS expression to resolve the
function name; it does not expose the schema as an API.

### B. Flip the share-token RPCs from `SECURITY DEFINER` to `SECURITY INVOKER`

`rotate_share_token` and `revoke_share_token` stay in `public` (the server
action calls them as `supabase.rpc('rotate_share_token', …)` which only
reaches `public`), but they no longer need DEFINER:

- Both functions already enforce `owner_id = auth.uid()` with an explicit
  pre-check.
- The downstream `UPDATE public.boards SET share_token = …` runs under the
  caller's RLS context, where the `boards_update` policy independently
  allows `owner_id = auth.uid() OR private.has_board_access(id, 'admin')`.
- `auth.uid()` and `gen_random_bytes(…)` both resolve under the caller's
  role (`authenticated`) without DEFINER.

The lint `authenticated_security_definer_function_executable` is
specifically about DEFINER functions, so switching to INVOKER closes it.
The explicit grant pattern (`revoke … from anon; grant execute … to
authenticated, service_role`) is preserved.

Effect: advisor lint count drops 8 → 2 against project
`xqdhpxfgrckjzzbenivp`. The remaining two are environmental and unrelated
(see "Consequences" below).

## Alternatives considered

- **Add `private` to `db.api.schemas` and call `private.rotate_share_token`
  from the server action.** Rejected — that re-exposes the schema and
  re-introduces the advisor lints. The whole point is for `private` to be
  outside the API.
- **Use a `public.*` thin wrapper that delegates to `private.*`.** Rejected
  for `rotate_share_token` / `revoke_share_token` — a SECURITY INVOKER
  wrapper around a DEFINER body still surfaces as a DEFINER function to
  the advisor; an INVOKER wrapper calling an INVOKER target adds a layer
  for no security gain. The cleanest fix was to just make the original
  function INVOKER.
- **Keep `has_*_access` in `public` and flip them to `SECURITY INVOKER`.**
  Rejected — under INVOKER the helper's SELECT against `boards` /
  `board_collaborators` would itself go through RLS, including the policy
  that calls the helper. Postgres protects against infinite recursion by
  short-circuiting nested policy checks, but the resulting truth values are
  subtle (`boards_read` would call `has_board_access`, which would query
  `boards` under `boards_read`, which would re-enter…). DEFINER + a
  trusted body that owns the SELECT is the well-trodden pattern; the move
  to `private` is what removes API exposure without changing semantics.
- **Drop the two `auth.users` triggers entirely and do profile creation
  client-side after sign-in.** Rejected — the trigger guarantees a profile
  row exists for every auth user atomically with signup; moving it to the
  client opens a race window (user authed but no profile, RLS rejects
  every subsequent query).

## Consequences

- **Six advisor lints clear**; only `extension_in_public` (`moddatetime` in
  the `public` schema) and `public_bucket_allows_listing` (the broad
  SELECT policy on the `avatars` bucket) remain, both environmental /
  cosmetic — moddatetime is provisioned by Supabase managed Postgres at
  cluster init, and the avatars bucket needs broad SELECT for public
  avatar URLs.
- **Every RLS policy in `0001` + `0005` + `0003` (storage) gets recreated**
  with `private.` qualification. The migration drops and recreates 17
  policies in `public.*` plus 2 in `storage.objects` in a single
  transaction, so there is no window where a table is RLS-enabled with
  no policies.
- **`scripts/smoke-supabase.sh` updated**: trigger functions and helpers
  now probe for `404` (function not in any exposed schema) instead of
  `403`. The share-token probes stay at `403`.
- **A fresh stack** that runs `0001 → 0009` ends up with the same shape
  as the live project. Migrations `0007` and `0008` remain in place — they
  are now no-ops against the post-`0009` state (the functions they
  revoked grants from no longer exist in `public`), but keeping them makes
  the audit trail readable and the stack idempotent.
- **Future SECURITY DEFINER functions** should default to landing in
  `private` if they're called from triggers or RLS-internal contexts, and
  in `public` only if they are explicit RPC surface (in which case the
  default-PUBLIC EXECUTE grant should be revoked immediately, à la `0007`).
