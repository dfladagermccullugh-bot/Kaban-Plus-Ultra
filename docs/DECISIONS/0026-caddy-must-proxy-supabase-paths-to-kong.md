# 0026. Caddy must reverse-proxy the Supabase API paths to Kong

- **Date**: 2026-05-16
- **Status**: accepted (implemented this session)

## Context

ADR 0022–0025 got the bundled self-host stack to the point where `/setup`
returns 200 and server-side supabase-js works (internal hop to
`http://kong:8000`). The next thing an operator does is **claim the
workspace and sign in via the magic link** — and that is the first time
the *browser* talks to Supabase directly.

`NEXT_PUBLIC_SUPABASE_URL` is `http://localhost` (or the real host) by
design: the browser bundle must use an origin the browser can resolve,
and it stays origin-relative to whatever host the operator typed. So the
browser issues:

- supabase-js: `GET http://localhost/rest/v1/…`, `…/auth/v1/token`,
  `…/storage/v1/object/…`, the `…/realtime/v1/` WebSocket, etc.
- the first-run magic link: `http://localhost/auth/v1/verify?token=…`
  (and `toPublicUrl` rewrites the link GoTrue built off the internal
  origin — see below).

But in the bundled topology **Caddy is the only thing listening on the
public host**, and it proxied *everything* to `web:3000` (the Next app).
The Next app has no `/auth/v1/*` or `/rest/v1/*` routes, so every one of
those browser requests would 404. Kong (`kong:8000`) — which owns all the
Supabase routing — is only reachable on the docker network. Nothing
bridged the public origin to Kong. The magic link, sign-in, and every
client-side data fetch were dead on a bundled deploy; this was latent
because no session had reached browser-side Supabase traffic (the gate
404 in ADR 0025 blocked `/setup` first).

## Decision

1. **Caddyfile proxies the Supabase API path prefixes to Kong.** Added a
   `@supabase` matcher for `/auth/v1/*`, `/rest/v1/*`, `/storage/v1/*`,
   `/realtime/v1/*`, `/functions/v1/*` and a `handle` block that
   `reverse_proxy`s them to `kong:8000`; a second `handle` block serves
   everything else from `web:3000` (preserving the `_next/static`
   immutable-cache header). The HSTS/nosniff `header` block moved to
   site level so it still covers both the app and the proxied API
   responses. The URI is forwarded **untouched** — Kong owns its own
   `strip_path` routing, so Caddy must not strip. WebSocket upgrades
   (realtime) pass through `reverse_proxy` transparently.

   Prefixes were verified against the pinned upstream
   `docker/supabase/upstream/docker/volumes/api/kong.yml` at
   `docker/supabase/PIN` = `v1.24.09`: `auth-v1` (`/auth/v1/`),
   `rest-v1` (`/rest/v1/`), `storage-v1` (`/storage/v1/`), `realtime-v1`
   (`/realtime/v1/`), `functions-v1` (`/functions/v1/`).

2. **Studio is deliberately NOT proxied.** Kong's `dashboard` service is
   a **catch-all** route on `/` (`http://studio:3000/`, protected only by
   HTTP basic-auth). Adding a Caddy passthrough for it — or proxying
   Kong's `/` — would expose the admin UI on every non-localhost host
   behind one shared basic-auth credential. We forward only the five
   explicit API prefixes; Studio stays reachable solely over the docker
   network (operator SSH-tunnels to the Kong port when they need it).

3. **`toPublicStorageUrl` → `toPublicUrl`** (logic unchanged). The helper
   already rewrote server-built storage URLs from the internal origin to
   the public one (ADR 0024). `auth.admin.generateLink()` has the exact
   same problem — it concatenates the admin client's internal origin, so
   the first-run magic link pointed at `http://kong:8000/auth/v1/verify…`,
   unreachable from the operator's browser. Same fix, broader name; now
   also applied to `linkData.properties.action_link` in
   `app/setup/actions.ts`. With (1) in place the rewritten
   `http://localhost/auth/v1/verify…` link resolves: Caddy → Kong →
   GoTrue.

4. **deploy-smoke gains a browser-path assertion.** After the `/setup`
   200 probe it sends a browser-equivalent request (the `apikey` Kong's
   key-auth requires, read from `docker/.env`'s `ANON_KEY`) to
   `http://localhost/auth/v1/health` and asserts the body names GoTrue —
   proving the full public-origin → Caddy → Kong → GoTrue path, the exact
   class this ADR fixes.

## Alternatives considered

- **Point `NEXT_PUBLIC_SUPABASE_URL` straight at Kong / a separate
  subdomain.** Rejected: it would mean a second public listener (more
  TLS/DNS/firewall surface for the one-liner installer to get right) or
  baking a non-origin-relative URL into the browser bundle, which breaks
  the "works on whatever host you typed" property and the localhost path.
  One front door (Caddy) routing by path is simpler and matches how
  hosted Supabase looks to the client (same-origin paths).
- **Proxy all of Kong (`reverse_proxy kong:8000` for `/`).** Rejected:
  Kong's catch-all is Studio behind shared basic-auth — that publishes
  the admin console. Explicit prefix allow-list only.
- **Rewrite the magic link to the public `/auth/v1/verify` without
  proxying that path.** Rejected: the link would still 404 — the rewrite
  is necessary but not sufficient; (1) and (3) are a pair.
- **Keep the helper named `toPublicStorageUrl`.** Rejected: it now also
  rewrites an auth action link; the storage-specific name would mislead.

## Consequences

- A bundled self-host install can finally complete the human loop:
  claim workspace → click magic link → signed in. Client-side data
  fetches, realtime, and storage reads from the browser all resolve.
- `deploy-smoke.yml` now guards both the server path (`/setup` 200) and
  the browser path (`/auth/v1/*` → GoTrue) on a real Docker runner.
- The Caddyfile is now path-routed (two `handle` blocks). Future routes
  must be slotted into the right block; the dead, unused `@hostHealth`
  matcher was removed in the same edit.
- Bumping `docker/supabase/PIN` must re-verify the five prefixes against
  the new tag's `kong.yml` (they have been stable across Supabase
  self-host for years, but the check is cheap).
- No change to the hosted-Supabase path (`SUPABASE_INTERNAL_URL` unset →
  `toPublicUrl` is a no-op, browser already talks to the managed origin).
- Still owed: the live operator `clone → install → claim-with-avatar →
  magic-link sign-in` run. No Docker in the harness; `deploy-smoke.yml`
  is the CI proxy until then.
