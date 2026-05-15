# 0022. Local Docker deployment is not seamless — eight bugs across installer, Dockerfile, env wiring, and routing

- **Date**: 2026-05-15
- **Status**: accepted — captured during a live Windows + Docker Desktop + Git Bash deployment attempt. Each bug below is a discrete, tractable fix for the next session.

## Context

A live `git clone -b main → bash scripts/install-kaban.sh` walkthrough on a Windows host (Docker Desktop + Git Bash, plenty of RAM/CPU) failed at eight distinct steps, each requiring a manual workaround to keep moving. The stack does eventually run end-to-end, but only after substantial deviations from the documented one-liner. The goal recorded here: a fresh `clone → docker compose -f kaban-stack.yml up -d → bootstrap.sh` should Just Work on any Docker-Engine ≥ 24 / Compose ≥ 2.20 host, including Windows + Git Bash.

## The eight bugs (in installation order)

### 1. `install-kaban.sh:211` — `compose pull` kills the script on locally-built images

```bash
docker compose --env-file ./.env -f kaban-stack.yml pull
```

`kaban-web:latest` is built locally from `docker/Dockerfile.web`; it doesn't exist in any registry, so `compose pull` returns non-zero. Under `set -euo pipefail` the entire script dies before `up -d --build` can build the image.

**Fix:** add `--ignore-pull-failures` to the `pull` invocation.

### 2. `install-kaban.sh` JWT-signing step — silent failure on Git Bash for Windows

The python:3.12-alpine container that patches `.env` with random secrets + signed JWTs mounts the file via `docker run -v "$ENV_FILE:/env:rw"`. On Git Bash MSYS rewrites `/c/Users/...` paths inside `docker run -v` arguments and Docker Desktop ends up mounting a different (often empty) location. The patcher reads no content, writes no content, exits 0. The `.env` file is left full of `change-me` placeholders, every Supabase service starts with the example secrets, and downstream auth eventually breaks in subtle ways.

**Fix options:**
- Prepend `MSYS_NO_PATHCONV=1` to the `docker run` call in `install-kaban.sh`.
- Better: rewrite the patcher to read `.env` from stdin and emit the patched content to stdout — no volume mount, no path mangling possible.

### 3. `docker/Dockerfile.web` — global `ARG TARGETPLATFORM` without a default

```Dockerfile
ARG TARGETPLATFORM
ARG BUILDPLATFORM

FROM --platform=$TARGETPLATFORM node:22-alpine AS deps
```

BuildKit auto-populates `TARGETPLATFORM` *inside* a stage (after `FROM`), but the global ARG declared *before* `FROM` is empty unless the caller passes it as a `--build-arg` OR via `--platform` to `buildx build`. `docker compose up --build` with the default builder resolves it to the empty string and the platform parser fails:

```
failed to parse platform : "" is an invalid component of "": platform specifier component must match "^[A-Za-z0-9_-]+$"
```

Worked around in testing with three explicit `--build-arg`s and a separate `buildx build` step.

**Fix options:**
- Drop the `--platform=$TARGETPLATFORM` clauses entirely on all three `FROM` lines. `node:22-alpine` is already a multi-arch manifest; BuildKit picks the host arch automatically when no platform is specified.
- Or default the ARG: `ARG TARGETPLATFORM=linux/amd64` (less clean — bakes an assumption).

### 4. `apps/web/public/` directory is missing — runtime stage COPY fails

```Dockerfile
COPY --from=build --chown=kaban:kaban /repo/apps/web/public  ./apps/web/public
```

The Next.js `public/` directory doesn't exist in the repo (no `.gitkeep` placeholder). The COPY errors out with:

```
"/repo/apps/web/public": not found
```

**Fix:** commit `apps/web/public/.gitkeep` so the directory always exists in the build context.

### 5. `install-kaban.sh` doesn't wipe the Postgres bind-mount on re-runs

The upstream Supabase compose bind-mounts the Postgres data dir to `docker/supabase/upstream/docker/volumes/db/data/`. `docker compose down -v` removes Docker-managed volumes (Caddy state, etc) but leaves the bind-mounted data on the host. On a second `up -d` with a different `POSTGRES_PASSWORD`, Postgres detects an existing `PGDATA`, skips initialisation, and keeps the **old** `supabase_admin` password. Every other Supabase container reads the new password from `.env` and the auth chain disagrees:

```
[error] Postgrex.Protocol failed to connect: ** (Postgrex.Error) FATAL 28P01 (invalid_password)
        password authentication failed for user "supabase_admin"
```

Worked around in testing with a manual `rm -rf supabase/upstream/docker/volumes/db/data/*`.

**Fix options:**
- Refuse to re-run with a different `POSTGRES_PASSWORD` against an existing data dir (detect + warn + bail).
- Or add an opt-in `--wipe` flag to the installer that does the rm and a `down -v` together.
- Document the manual recovery in `docs/SELF_HOSTING.md` as a hazard.

### 6. **`apps/web/lib/env.ts:getSupabaseUrl()` ignores `SUPABASE_INTERNAL_URL`** — server-side calls fail

`docker/kaban-stack.yml` correctly exports `SUPABASE_INTERNAL_URL=http://kong:8000` to the `kaban-web` container so server-side Supabase calls stay on the docker network. `getSupabaseUrl()` (used by `apps/web/lib/supabase/admin.ts:createAdmin`) reads only `NEXT_PUBLIC_SUPABASE_URL`. The browser bundle has `http://localhost` baked in (correct for the browser); the server-side admin client reads the same baked-in value (wrong — `localhost` inside the container is the container itself, not the host).

End-user impact: `/setup` returns 404. The page's `setupGate()` calls `isWorkspaceEmpty()`, which calls `createAdmin().from('profiles').select(...)`. The fetch goes to `http://localhost/rest/v1/profiles` from inside the container, hangs / errors, the catch in `setupGate` returns `{ok: false, reason: 'env'}`, and `page.tsx` calls `notFound()`.

**Critical detail:** runtime env overrides of `NEXT_PUBLIC_*` don't help. Next.js inlines `NEXT_PUBLIC_*` env vars at build time as string literals — even on the server side. The only fix is to read a separate env var server-side.

**Fix (one line, `apps/web/lib/supabase/admin.ts:17`):**

```diff
-  const url = getSupabaseUrl();
+  const url = process.env.SUPABASE_INTERNAL_URL ?? getSupabaseUrl();
```

Or refactor `getSupabaseUrl()` to take a `{ server: true }` argument and consult `SUPABASE_INTERNAL_URL` first when called server-side. Same change probably needed in `apps/web/lib/supabase/server.ts` (the cookie-aware server-side anon client) and `apps/web/lib/supabase/middleware.ts`.

### 7. `docker/Caddyfile` — forces HTTPS even for `KABAN_HOST=localhost`

Caddy's `localhost` site responds with a `308 Permanent Redirect` to `https://localhost/…` for every plain-HTTP request. The browser hits HTTPS, gets a self-signed cert warning, and the test loop becomes "click through the warning every time." For a local-only deployment, plain HTTP on port 80 is the expected interface.

**Fix:** make the Caddyfile serve `http://` directly when `KABAN_HOST` is `localhost` or `127.0.0.1`. Either a conditional block or a separate `Caddyfile.localhost` referenced by an env-var-driven include.

### 8. `docker/bootstrap.sh` — path mangling on Git Bash for Windows

```bash
COMPOSE_FILE="$PWD/kaban-stack.yml" bash ./bootstrap.sh
```

`$PWD` in Git Bash returns `/c/Users/...`. With `MSYS_NO_PATHCONV=1` set (which we need for `docker compose` itself), `$PWD` doesn't get rewritten — but the docker daemon then receives the literal `/c/Users/...` path and prepends `C:` itself, producing the nonsensical `C:\c\Users\…\kaban-stack.yml`:

```
open C:\c\Users\LCAC\Documents\test_apps\kaban\kaban-plus-ultra\docker\kaban-stack.yml:
  The system cannot find the path specified.
```

Worked around with a relative path: `COMPOSE_FILE=kaban-stack.yml bash ./bootstrap.sh`.

**Fix:** `bootstrap.sh` should default `COMPOSE_FILE` to the relative path of `kaban-stack.yml` in its own directory and accept absolute paths only as an explicit override. Add a note to the script's usage examples in `docs/SELF_HOSTING.md`.

### Honourable mention: `.env.example:93` — unquoted value with spaces

```
STUDIO_DEFAULT_PROJECT=Kaban Plus Ultra
```

Sourcing this file with `set -a; . ./.env; set +a` causes bash to assign `STUDIO_DEFAULT_PROJECT=Kaban` and then try to execute `Plus Ultra` as a command:

```
bash: Plus: command not found
```

Functionally harmless (Compose reads the file differently), but every `bootstrap.sh` run prints two `command not found` errors. Wrap the value in quotes.

## Decision

Bundle all eight fixes (plus the unquoted-value cleanup) into one focused session. They are independent, each fix is small, and together they unblock `git clone → docker compose up -d → bootstrap.sh → open the URL` on any Docker host without manual intervention. Tested workflow at session end:

```bash
git clone https://github.com/dfladagermccullugh-bot/kaban-plus-ultra.git
cd kaban-plus-ultra
KABAN_HOST=localhost bash scripts/install-kaban.sh
# Installer prints: http://localhost/setup?t=<random>
# Open in browser, claim workspace, done.
```

Also worth doing in the same session:

- **Add a CI job** that runs the install on a clean Ubuntu runner and probes `http://localhost/setup` for 200 after bootstrap. Catches regressions of this whole class of bug.
- **Add `docs/SELF_HOSTING.md` "Troubleshooting"** section covering: cleaning bind-mounts on rotation, Git Bash path quirks, self-signed cert warnings, the `KONG_HTTP_PORT` env knob.

## Alternatives considered

- **Document the workarounds and call it a day.** Rejected — eight manual workarounds is not a self-host story, and #4 + #5 + #6 are real bugs (not Windows-only) that affect any operator.
- **Drop Caddy entirely and let `kaban-web` listen on host port directly.** Rejected — Caddy gives us automatic Let's Encrypt for real deployments; we just need to be smarter about `localhost`.
- **Switch to a published `kaban-web` image on Docker Hub or GHCR.** Worth considering separately — would eliminate #1, #3, #4 in one move — but trades the build-from-source ergonomic developers expect. Defer to a follow-up session.

## Consequences

- A fresh-host install becomes ~5 commands total, all standard Docker, no platform-specific notes needed.
- The local dev loop (clone → run) matches what we want operators to do, so we dogfood the same path.
- Eight small commits or one focused commit, no schema impact, no security model change.
- Bug #6 specifically removes the last blocker to live-Lighthouse / live-browser testing — once `/setup` works locally, every prior "blocked on no browser" item in the roadmap becomes tractable on any laptop.
