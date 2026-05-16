# 0026. Self-host: Caddy must reverse-proxy Supabase paths to kong

- **Date**: 2026-05-15
- **Status**: accepted (decision recorded; **implementation deferred to a dedicated session**)

## Context

The live local-Docker trial (Windows + Git Bash + Docker Engine) that
found and fixed ADR 0024 (storage origin) and ADR 0025 (`PGRST_DB_SCHEMAS`)
continued past `/setup`. Claiming the workspace **with an avatar** proved
ADR 0024's code correct — `profiles.avatar_url` was persisted as
`http://localhost/storage/v1/object/public/avatars/<uid>/avatar.png`
(public origin, not `kong:8000`). But two follow-on facts surfaced a
deeper, foundational gap:

1. The first-run magic link returned by `claimWorkspace`'s
   `admin.auth.admin.generateLink()` was
   `http://kong/auth/v1/verify?token=…&redirect_to=http://localhost/auth/callback…`
   — host `kong` (internal Docker name, no port) → browser
   `DNS_PROBE_FINISHED_NXDOMAIN`. GoTrue v2.158.1 builds the admin
   `generate_link` URL from the **proxied request host**, and ADR 0022
   points the admin client at `SUPABASE_INTERNAL_URL=http://kong:8000`,
   so the link base is `kong`. Same class as ADR 0024 (a server-built
   URL bound for the browser that carries the internal origin).

2. Investigating *where* the corrected origin should point exposed the
   real problem: **Caddy never proxies Supabase paths to kong.**

### The topology gap (root cause)

- Caddy (the only thing on host `:80`, the public origin) has a single
  `reverse_proxy web:3000` — no routes for `/auth/v1`, `/rest/v1`,
  `/storage/v1`, `/realtime/v1`, `/functions/v1`, or `/project` (Studio).
- kong is reachable only on host `:8000`.
- The installer sets `NEXT_PUBLIC_SUPABASE_URL=http://localhost` (the
  Caddy origin, port 80).

Probes (`http://localhost/<path>`):

| path | result |
|---|---|
| `/auth/v1/health` | 307 (Next, not GoTrue) |
| `/rest/v1/` | 308 |
| `/storage/v1/object/public/avatars/x` | 307 |
| `/project/default` (Studio, advertised by the installer banner) | 307 |

So **all browser-side Supabase access on self-host is broken**: client
auth/sign-in, realtime, the avatar `<img>` (ADR 0024's value
`http://localhost/storage/...` 307s), the magic-link `verify`, and the
Studio link the installer prints. Server-side calls are fine — they use
`SUPABASE_INTERNAL_URL=http://kong:8000` directly (ADR 0022). Only the
browser path was never wired.

This was latent because no prior session reached a *browser* against a
self-host stack — every check was server-side or `curl` without
`Accept-Profile`, and CI's `deploy-smoke.yml` only probes `/setup` (a
Next route) for 200.

## Decision

The canonical Supabase "behind one domain" design is correct and intended
here (the installer advertises a single origin and `/project` for Studio;
`NEXT_PUBLIC_SUPABASE_URL` is the bare host with no port). **Caddy must
reverse-proxy the Supabase API + Studio paths to `kong:8000`**, keeping
`NEXT_PUBLIC_SUPABASE_URL=http://localhost`. The first-run magic link must
additionally have its origin rewritten from the internal host to the
public origin at the boundary (ADR 0024-class), since GoTrue emits `kong`
regardless once it is called via the internal gateway.

Rejected — *expose kong on a port and set
`NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`*: two origins, a CORS
surface, uglier URLs, and a weak HTTPS story for the real-host (Let's
Encrypt) case. Contradicts the single-origin design already baked into
the installer banner and env.

Implementation is **deferred to a dedicated session** (the user's call):
it is an architecture change to the deployment edge with security choices,
needs several live-stack iterations (no Docker in the harness), and should
not be rushed at the tail of the trial that uncovered it.

## Recommended implementation (for the next session)

1. **Caddyfile** — before the catch-all `reverse_proxy web:3000`, add a
   matcher routing the Supabase paths to kong:
   ```
   @supabase path /auth/v1/* /rest/v1/* /storage/v1/* /realtime/v1/* /functions/v1/* /graphql/v1/*
   reverse_proxy @supabase kong:8000
   ```
   Decide Studio (`/project*` + its assets): route to kong too, or gate
   behind basic-auth / leave Studio on `:8000` only. Studio exposure on
   the public origin is the main **security** decision — default to
   *not* exposing Studio via Caddy on a real (non-localhost) host, or
   protect it. Confirm kong's own route prefixes against the pinned
   `kong.yml` (`docker/supabase/upstream/docker/volumes/api/kong.yml`)
   before finalizing the matcher list (realtime path may be
   `/realtime/v1/*` websockets — needs `reverse_proxy` to pass upgrades,
   which Caddy does by default).
2. **Magic-link origin rewrite** — generalize `toPublicStorageUrl()` in
   `apps/web/lib/env.ts` to a non-storage-specific `toPublicUrl()` (the
   logic is already a generic internal→public origin swap), update its
   two call sites + `tests/public-storage-url.test.ts` (rename), and
   apply it to `linkData.properties.action_link` in
   `apps/web/app/setup/actions.ts`. Email-triggered links (no request
   context) use GoTrue's `API_EXTERNAL_URL` and are already correct;
   only the admin `generate_link` path needs the rewrite.
3. **Verify on the live stack** (operator): fresh `/setup` claim with an
   avatar → avatar `<img>` renders (200, not 307); magic link opens
   `http://localhost/auth/v1/verify…` → lands signed-in at `/boards`;
   browser sign-in round-trips.
4. **deploy-smoke.yml** — add a browser-path assertion (e.g.
   `curl -fsS http://localhost/auth/v1/health` and a HEAD on a public
   storage object) so this class is caught in CI, not just `/setup`.
5. ADR follow-up: mark this ADR's implementation done and note the final
   Studio decision.

## Consequences

- Until implemented, self-host is usable only up to `/setup` account
  creation; first sign-in (and all client-side Supabase) is broken. ADR
  0024 and 0025 remain correct and necessary — they are prerequisites
  this gap sits on top of, not regressions.
- The hosted-Supabase deployment path is unaffected (managed gateway and
  public URL are the same origin already).
