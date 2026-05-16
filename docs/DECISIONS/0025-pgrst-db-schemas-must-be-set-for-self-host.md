# 0025. The bundled self-host `.env` must set `PGRST_DB_SCHEMAS`

- **Date**: 2026-05-15
- **Status**: accepted

## Context

A live `git clone → KABAN_HOST=localhost bash scripts/install-kaban.sh`
on a Windows + Git Bash + Docker host brought the whole stack up healthy,
but `/setup?t=<token>` returned **HTTP 404** for every token (correct or
not). The token matched, the route was built, the server process had all
env vars, and a raw `HEAD http://kong:8000/rest/v1/profiles` from inside
the web container returned `200 / content-range */0`. Yet the setup gate
denied.

`app/setup/setup-gate.server.ts` swallowed the cause with a bare
`catch {}` → `reason:'env'` → `notFound()` → an undebuggable silent 404.
Instrumenting the gate (logged error shape, a same-runtime raw fetch, and
a `globalThis.fetch` spy around the real probe) produced the smoking gun:

```
[setup-gate][spy] HEAD http://kong:8000/rest/v1/profiles?select=id -> 406 Not Acceptable
```

while an identical *raw* fetch returned 200. The only material difference:
**supabase-js always sends `Accept-Profile: public`** (it sets
`db.schema = 'public'` by default and emits the profile header).
PostgREST returns **406 Not Acceptable** when the requested schema profile
is not in its configured exposed-schema list — and that list was empty:

```
The "PGRST_DB_SCHEMAS" variable is not set. Defaulting to a blank string.
```

Root cause: `docker/.env.example` (52 keys, hand-authored) was missing
`PGRST_DB_SCHEMAS`. The pinned upstream Supabase compose
(`docker/supabase/PIN` = `v1.24.09`) references `${PGRST_DB_SCHEMAS}`
**with no default**, so PostgREST booted with `db-schemas=''`. Requests
*without* a profile header fell back to PostgREST's internal default and
worked (so every hand-rolled `curl`/Node probe was green, and `/` and
`/sign-in` rendered) — but every real supabase-js call, which always
carries `Accept-Profile: public`, was 406'd. `/setup` was simply the
first server-side supabase-js data access in the request path.

The same Compose run warned about five more bare `${VAR}` references the
hand-authored `.env.example` never satisfied: `MAILER_URLPATHS_{CONFIRMATION,
INVITE,RECOVERY,EMAIL_CHANGE}` (⇒ broken verification-email links) and the
legacy `LOGFLARE_API_KEY` alias.

Appending `PGRST_DB_SCHEMAS=public,storage,graphql_public` to the live
`.env` and recreating `rest` flipped `/setup` to **200** and the spy to
`HEAD … -> 200 OK`, confirming both cause and fix.

## Decision

1. **`docker/.env.example`** carries the full set of upstream vars the
   pinned compose references with no default — `PGRST_DB_SCHEMAS`
   (`public,storage,graphql_public`), the four `MAILER_URLPATHS_*`
   (`/auth/v1/verify`), and `LOGFLARE_API_KEY`. Fresh installs
   (`cp .env.example .env` + patch secrets) are correct by construction.

2. **`scripts/install-kaban.sh` backfills**. The installer previously kept
   an existing `.env` *entirely* as-is, so any deployment created before
   this fix would stay broken across an upgrade. The "else" branch now
   appends every `.env.example` key absent from the live `.env`, using the
   example's default value, and **never touches existing lines** (secrets
   are preserved). Pure POSIX `sh`, no `awk`, no `-v` mount — MSYS/Git
   Bash-safe, consistent with ADR 0023's installer constraints.

3. **Keep minimal gate observability**. The bare `catch {}` that hid this
   for the entire investigation is itself a defect: a misconfigured
   self-host deserves a logged reason, not a silent 404. `setup-gate`
   now `console.error`s the denial reason and the caught error. All the
   heavy trial-only instrumentation (reachability probe, fetch spy, error-
   shape dump) was reverted.

### Why not pin a default in our own compose layer instead

`docker/kaban-stack.yml` could add `PGRST_DB_SCHEMAS: ${PGRST_DB_SCHEMAS:-public,storage,graphql_public}`
as an override. Rejected: ADR-0021 deliberately keeps the upstream compose
**stock** (re-pinning is a single-file change in `docker/supabase/PIN`),
and the upstream `rest` service lives in the included upstream file, not
our override block. Fixing it in `.env(.example)` keeps the upstream graph
untouched and fixes the *class* (all unset bare `${VAR}` refs) in one
place, not just this symptom.

## Consequences

- Fresh installs and upgrades both get a working PostgREST exposed-schema
  list; `deploy-smoke.yml` (already probing `/setup` for 200 via the real
  installer) is the standing regression guard and would now have caught
  this on a real Docker host — it had simply never run against one.
- `.env.example` is now the single source of truth for "every var the
  pinned upstream needs"; bumping `docker/supabase/PIN` should re-audit it
  against the new tag's Compose `${VAR}` references.
- No app, schema, or hosted-environment change. The hosted Supabase path
  is unaffected (managed PostgREST exposes `public` already).
