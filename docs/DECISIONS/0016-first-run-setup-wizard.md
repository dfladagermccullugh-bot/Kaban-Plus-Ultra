# 0016. First-run setup wizard for the bundled self-host stack

- **Date**: 2026-05-13
- **Status**: accepted

## Context

A fresh `install-kaban.sh` deploy lands with an empty `profiles` table.
The trigger seeds a profile + demo board when `auth.users` gets its
first row, but the user can only get a row in `auth.users` via the
magic-link flow on `/sign-in` — which requires a working SMTP and an
external email round-trip. On a brand-new VPS, the operator typically
has neither configured yet, so the app is unreachable to its own owner.

We need a one-time, gated bootstrap path: claim the workspace owner
account without leaving the host, then continue normally. Phase 7's
roadmap calls this out as the final open checkbox.

Constraints:

- Must be reachable on a fresh deploy, but not later. Anyone scanning
  the install for `/setup` after the owner is claimed should see a 404.
- Must not be reachable to a random internet visitor on a fresh deploy
  either — leaving an unguarded "create the admin" endpoint visible
  during the first hour is a take-the-instance attack.
- Must not require SMTP (chicken-and-egg) but should support the
  hosted-Supabase case where SMTP _does_ work.
- Avatar upload is optional — the owner can also set it later in
  `/profile`.

## Decision

**`/setup` route, gated by a per-deploy `SETUP_TOKEN` plus an empty
`profiles` check, generated and burned by `install-kaban.sh`.**

Concretely:

- `install-kaban.sh` adds a 32-char random `SETUP_TOKEN` to
  `docker/.env` next to `POSTGRES_PASSWORD` / `JWT_SECRET` /
  `DASHBOARD_PASSWORD` / signed JWTs. It threads it through
  `docker/docker-compose.yml` and `docker/kaban-stack.yml` to the web
  container's runtime env, and prints
  `https://$KABAN_HOST/setup?t=<token>` in the final install banner.
- The server-side gate (`apps/web/app/setup/setup-state.ts` +
  `setup-gate.server.ts`) requires BOTH:
  1. `process.env.SETUP_TOKEN` is non-empty AND the supplied `?t=`
     matches it via a constant-time compare,
  2. `profiles` is empty (counted via the service-role client).
  Any other state → `notFound()` (404).
- The "already claimed" reason renders a small "Setup is complete"
  page that nudges the operator to `/sign-in`. We split this from
  the 404 because it's the friendly case where the operator hits a
  bookmarked URL after first sign-in — they shouldn't think the link
  is broken.
- The `claimWorkspace` server action re-runs the gate before mutating
  anything, then creates the owner via
  `auth.admin.createUser({ email_confirm: true })`, updates the
  trigger-seeded profile with their `display_name` / `accent_color`,
  optionally uploads an avatar to the `avatars` bucket (via service
  role, bypassing RLS; path is `<userId>/avatar.<ext>` so the bucket's
  per-user prefix policy still applies for future overwrites), then
  best-effort generates a magic-link via `auth.admin.generateLink` and
  returns it for inline display.
- Magic-link is surfaced inline because SMTP may not be configured.
  If `generateLink` fails (e.g. site URL mismatch on a misconfigured
  install), the success page falls back to "Go to sign-in" — the
  account already exists, so the standard `/sign-in` page works.
- Middleware adds `/setup` to `PUBLIC_PATHS` so the auth redirect
  doesn't bounce an unauthenticated operator off the page.

## Alternatives considered

- **Bake the owner email into `install-kaban.sh` and create the user
  via `psql` at boot.** Possible, but every "back-door create the
  admin" path needs operator UX (email entry, display name, avatar) on
  the host, which is much worse than a web form. Also bakes a plaintext
  email into shell history.
- **No gate; just rely on "profiles is empty".** Tempting because the
  empty-table check is itself a strong invariant. But there's a race:
  any attacker who can reach the public URL before the operator does
  can claim the workspace owner account on a fresh deploy. A 32-char
  token folds that window to zero.
- **`SETUP_EMAIL` allow-list instead of a token.** Equivalent strength
  but the operator has to know their final email when they run the
  installer, which conflicts with people who deploy first and pick the
  email later.
- **Use Supabase Studio's auth UI to create the user.** Studio is
  available on the bundled stack at `/project`, but it leaves the
  `profiles` row in trigger-default state and doesn't help with avatar
  upload or accent color. Also, Studio's invite UI emails the user,
  which is exactly the failure mode we're sidestepping.
- **Single-use token consumed at submit.** Considered, but the
  "profiles empty" check is itself effectively single-use — once an
  owner is claimed, the gate self-disables regardless of what happens
  to the token. Tracking token state in the DB just to invalidate it
  faster adds a migration for negligible value.

## Consequences

**Easier**

- Fresh-VPS install ends with a working `/sign-in` for the owner.
- Operator never has to touch `psql` to bootstrap.
- The gate self-disables, so accidentally leaving `SETUP_TOKEN` in
  `docker/.env` after first sign-in doesn't create a persistent
  back door.

**Harder**

- Re-bootstrap (e.g. operator claimed the wrong email) now requires
  manually deleting the row from `auth.users` — documented in
  `docs/SELF_HOSTING.md`.
- `SUPABASE_SERVICE_ROLE_KEY` is now a hard requirement for the
  first-run wizard in addition to invite-by-email and audit-events.
  The installer already provisions it; the hosted-Supabase path
  documents it.

**To watch**

- If we ever add a "multi-tenant workspaces" feature, the
  "first profile claims the workspace" assumption breaks. Revisit then;
  for v1 single-workspace this is the right model.
- The constant-time compare is in JS user code rather than
  `crypto.timingSafeEqual` because `setup-state.ts` is also imported
  in the test runner (jsdom) and `node:crypto` adds a polyfill burden.
  Acceptable for a token check that runs at most a few times per
  deploy.
