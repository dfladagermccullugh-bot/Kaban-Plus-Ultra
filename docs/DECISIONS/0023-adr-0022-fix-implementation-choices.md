# 0023. Implementation choices for the ADR-0022 local-Docker fixes

- **Date**: 2026-05-15
- **Status**: accepted

## Context

ADR 0022 catalogued eight local-Docker deployment bugs from a live
Windows + Git Bash test and proposed a fix for each. Landing them
surfaced a few choices where ADR 0022 offered options or where the
obvious fix had a subtlety. This ADR records the ones a future reader
would otherwise have to reverse-engineer.

## Decisions

### 1. The JWT-signing patcher takes `.env` via an env var, not stdin

ADR 0022 #2 suggested "rewrite the patcher to read `.env` from stdin".
That can't work as written: the Python program is fed to `python -` over
stdin via a `<<'PY'` heredoc, so stdin is already consumed. Two
stdin redirections (`<"$ENV_FILE"` + the heredoc) collapse to the last
one in bash, and `python -` reads its program to EOF leaving
`sys.stdin` empty. So the unpatched `.env` body rides in on
`-e ENV_CONTENT="$(cat "$ENV_FILE")"` and the patched file comes back on
stdout (captured, written with a single trailing newline). No volume
mount → no MSYS `-v` path mangling, which was the actual bug. `.env` is
~4 KB, far under any env/argv limit.

### 2. A single `getServerSupabaseUrl()` helper, applied to four call sites

ADR 0022 #6 proposed a one-line change in `admin.ts`. The same
build-time-inlining trap (`NEXT_PUBLIC_SUPABASE_URL` → `http://localhost`
baked into the server bundle) hits **every** server-side Supabase client,
not just the admin one. We added `getServerSupabaseUrl()` to `lib/env.ts`
(prefers `SUPABASE_INTERNAL_URL`, falls back to the public URL) and
routed `admin.ts`, `server.ts`, `lib/supabase/middleware.ts`, and the
server-rendered share page `app/s/[id]/page.tsx` through it. `browser.ts`
deliberately stays on `getSupabaseUrl()` — the browser must hit the
public hostname. Middleware keeps its env-missing graceful pass-through
keyed on the public vars; only the resolved fetch URL changes.

### 3. Caddy localhost HTTP via a `KABAN_SCHEME` env, not a second Caddyfile

ADR 0022 #7 offered "a conditional block or a separate
`Caddyfile.localhost`". The Caddyfile has no real conditionals, and a
second mounted file means installer + compose both have to pick the right
one. Instead the site address is `{$KABAN_SCHEME:https}://{$KABAN_HOST}`:
an explicit `http://` scheme disables Caddy automatic-HTTPS for that
site (plain `:80`, no 308, no cert). `install-kaban.sh` derives
`KABAN_SCHEME` from `KABAN_HOST` (localhost/127.0.0.1 → `http`, else
`https`) and the patcher writes it into `.env`;
`docker-compose.yml` passes `KABAN_SCHEME: ${KABAN_SCHEME:-https}`. A
hand-edited `.env` with no `KABAN_SCHEME` defaults to `https` — i.e. the
prior production behaviour is unchanged. The always-on HSTS header is
left as-is: browsers ignore HSTS received over plain HTTP, so it's inert
for the localhost case and not worth a conditional we can't express.

### 4. Stale-Postgres guard bails by default; `--wipe` is the opt-in

ADR 0022 #5 listed both "detect + bail" and "an opt-in `--wipe` flag";
the task asked for bail-by-default. The precise trigger matters: the
hazard only exists when `docker/.env` was *just regenerated* (fresh
random `POSTGRES_PASSWORD`) on top of an existing data dir. A normal
upgrade re-run keeps the existing `.env`, so it must NOT bail (that would
break the documented safe-upgrade path). So the guard fires only when
`env_existed == 0` AND the bind-mount dir is non-empty. `--wipe` does
`down -v` + `rm -rf` the bind mount.

### 5. The CI deploy-smoke deviates from the "<10 min" target

The task asked for a CI job under 10 minutes. The bundled stack is the
full upstream Supabase compose (~15 containers) plus a Next standalone
build — that does not fit in 10 minutes on a GitHub-hosted runner, and
running it on every push would be slow and flaky. `deploy-smoke.yml`
instead runs on a nightly schedule, on `workflow_dispatch`, and on PRs
that touch the deploy surface (paths filter), with a 30-minute job cap
and an internally-bounded 3-minute `/setup` probe loop. It still catches
the entire ADR-0022 regression class; it just isn't on the hot path.

## Consequences

- One env helper is the single place server-vs-browser Supabase origin
  is decided; new server-side clients should call `getServerSupabaseUrl()`.
- `KABAN_SCHEME` is a new `.env` knob — documented in `.env.example` and
  the SELF_HOSTING troubleshooting section.
- `deploy-smoke.yml` is not a per-push gate; a deploy regression merged
  between nightly runs is caught at the next schedule or the next
  deploy-surface PR, not immediately. Acceptable trade for CI cost.
- The live `clone → install-kaban.sh → browser` validation still needs a
  real Docker host (none in the harness); the CI job is the proxy until a
  fresh-VPS dry run happens.
