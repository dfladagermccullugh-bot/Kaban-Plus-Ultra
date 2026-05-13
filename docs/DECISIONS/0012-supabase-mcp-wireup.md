# ADR 0012 — Supabase MCP wire-up

- **Date**: 2026-05-13
- **Status**: Accepted
- **Phase**: 6/7 boundary

## Context

Until this session the project had no live Supabase to connect to —
every previous session listed "Supabase provisioning still local-only"
as a blocker. The harness now exposes a Supabase MCP connector (tool
prefix `mcp__d254b538-…__*`) and the human has already created a
project named **"Kaban Plus Ultra"** (ref `xqdhpxfgrckjzzbenivp`,
region `us-west-2`, status `ACTIVE_HEALTHY`).

We needed to decide:

1. Which project to bind to (the org has three — Equipment Reservation,
   Astrology AI, Kaban Plus Ultra).
2. How to apply the existing `supabase/migrations/0001` → `0006` files
   against it (no `supabase` CLI in the harness, no `psql` against the
   pooler).
3. Where to put the project URL and anon key.
4. What to do about `SUPABASE_SERVICE_ROLE_KEY` — the MCP exposes
   `get_publishable_keys` (anon + new publishable token) but not the
   service-role key.

## Decision

- Bind to the project literally named **"Kaban Plus Ultra"**. Skip the
  other two — name match is unambiguous.
- Apply migrations by calling
  `mcp__d254b538-…__apply_migration` once per file, in order. The MCP
  records the migration in Supabase's own migration table so a later
  `supabase db pull` against this project still works.
- Write the project URL + legacy anon JWT into
  `apps/web/.env.local` (already gitignored). Use the **legacy anon
  JWT**, not the new `sb_publishable_…` token, because the existing
  `apps/web/lib/supabase/*.ts` clients are built on `@supabase/ssr` 0.5,
  which currently expects the JWT shape.
- Leave `SUPABASE_SERVICE_ROLE_KEY` out of `.env.local` with a TODO
  comment. Routes that need it (invite-by-email, audit-events writer)
  already throw a clear error at runtime; the operator can drop the key
  in by hand without redeploying.

## Verified

- All 6 migrations applied — `list_migrations` returns versions
  `20260513180358` (`0001_init`) through `20260513180502`
  (`0006_profiles_email`).
- `list_tables` returns the 10 expected public tables
  (`audit_events`, `board_collaborators`, `boards`, `card_labels`,
  `cards`, `columns`, `images`, `labels`, `profiles`, `rows`).
- `get_advisors` reports only pre-existing design warnings (SECURITY
  DEFINER on the helper functions, `moddatetime` in `public`, public
  `avatars` bucket allows listing). These are intentional per
  `docs/SECURITY.md` / `docs/DATA_MODEL.md` — not regressions.

## Consequences

- Subsequent sessions can talk to a real Postgres without spinning up
  `supabase start` locally. Realtime, storage policies, and the signup
  trigger all work end-to-end the moment a user signs in.
- The first user who signs in via magic link will trigger
  `on_auth_user_created()` and auto-create a "Welcome to Kaban" demo
  board.
- Future migrations should still be **added as files** under
  `supabase/migrations/` (canonical source) and **then applied** via the
  MCP `apply_migration` tool — keeps the two stores in sync.
