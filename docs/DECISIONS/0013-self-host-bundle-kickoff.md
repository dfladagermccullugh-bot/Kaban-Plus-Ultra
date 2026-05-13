# ADR 0013 — Self-host bundle (Phase 7 kickoff)

- **Date**: 2026-05-13
- **Status**: Accepted
- **Phase**: 7 (kickoff — not yet end-to-end on a fresh VPS)

## Context

Phase 7 promises "one command spins up a private instance." A polished
single-tarball deploy is a multi-session effort; this ADR captures the
**kickoff** scope chosen for this session — enough that a sysadmin
can hand-roll a working install today.

The hard question was where to draw the line on Supabase. Bundling the
full upstream stack (db / auth / rest / realtime / storage / kong)
inline would balloon `docker-compose.yml` to ~300 lines and pin us to a
specific Supabase release, breaking on every upgrade. Skipping Supabase
entirely would leave the operator with a half-installed system.

## Decision

- Ship a **two-service compose**: `web` (built from
  `docker/Dockerfile.web`) + `caddy` (auto-HTTPS reverse proxy).
- Two documented Supabase paths in `docs/SELF_HOSTING.md`:
  - **Path A — Hosted Supabase.** Point the env vars at a real
    `supabase.com` project. Simplest; matches our dev setup.
  - **Path B — Self-hosted Supabase.** Clone
    `github.com/supabase/supabase` and layer its compose alongside ours
    (`docker compose -f a.yml -f b.yml up`). We own the kaban-web /
    caddy half; upstream owns the Supabase half. No version pinning
    inside our repo — the operator picks a Supabase release tag.
- `output: 'standalone'` in `next.config.ts` so the runtime image only
  carries traced node_modules (~200 MB Alpine image instead of 1+ GB
  of the monorepo).
- Set `outputFileTracingRoot` to the repo root — Next's tracer needs to
  walk past `apps/web/` to pick up workspace deps (`@kpu/core`,
  `@kpu/db`, `@kpu/ui`).
- Caddy serves Let's Encrypt out of the box; falls back to a self-signed
  cert when `KABAN_HOST=localhost`.
- Publishable envs (`NEXT_PUBLIC_*`) are baked at **build time** via
  `--build-arg`; `SUPABASE_SERVICE_ROLE_KEY` is read at **runtime** from
  the container env — never in the image, never in the bundle.

## Alternatives considered

- **Inline the full Supabase stack** — rejected: too coupled to a
  specific Supabase release; we'd own every upstream breakage.
- **Use the official `supabase/supabase-self-host` repo as a submodule**
  — defer to Phase 7 main work. A submodule needs the right pin and
  initialization flow; for kickoff we tell the operator to clone it
  themselves.
- **Distroless runtime base** — rejected for now; Alpine + non-root
  user is enough and lets the operator `docker exec` for debugging.

## Verified

- `pnpm lint`, `pnpm typecheck` clean after the `next.config.ts` edits.
- `docker/Dockerfile.web`, `docker/docker-compose.yml`,
  `docker/Caddyfile`, `docker/.env.example`, `docs/SELF_HOSTING.md` all
  written.
- Build of the Docker image not exercised in this harness — no Docker
  daemon. The same `next build` runs under `pnpm build` already, so the
  build stage failing would also break CI.

## Follow-ups (Phase 7 main)

- Pin the upstream Supabase compose to a known-good tag and check in a
  `docker/supabase/` directory.
- Write a `kaban-stack.yml` that merges both compose files for the
  one-liner case.
- Add a `bootstrap.sh` that runs the migrations the first time the DB
  container is healthy.
- ARM64 multi-arch image (Raspberry Pi class).
- First-run admin wizard.
