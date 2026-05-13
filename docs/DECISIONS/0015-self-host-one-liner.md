# ADR 0015 — Self-host one-liner installer + merged stack

- **Date**: 2026-05-13
- **Status**: Accepted
- **Phase**: 7 (main work — completes ADR 0013's "follow-ups")

## Context

ADR 0013 shipped the Phase 7 kickoff: a two-service compose
(`web` + `caddy`) and two documented Supabase paths (hosted /
self-hosted) in `docs/SELF_HOSTING.md`. The follow-ups it listed were
"pin the upstream Supabase compose into `docker/supabase/`", "write
`kaban-stack.yml` that merges both compose files", "first-boot
migrations", and "a one-liner installer". This session lands all four.

The hard sub-decisions:

1. **How to pin Supabase.** The upstream `supabase/supabase` self-host
   compose is ~16 KB by itself and bind-mounts ~30 files under a
   sibling `volumes/` tree (Postgres init SQL, Kong config, vector
   config, …). Vendoring the whole subtree into our repo forks it the
   moment anyone touches it; vendoring just the compose breaks the
   bind mounts.

2. **How to merge our compose with upstream's.** `docker compose -f
   a.yml -f b.yml` works but the operator has to remember the file
   chain. The newer `include:` directive (Compose v2.20+) lets one
   top-level file pull in another and resolves the included file's
   relative paths against its own directory — exactly what we need so
   upstream's `./volumes/...` mounts still find their files.

3. **How to sign JWTs in the installer.** The upstream `.env.example`
   ships demo `ANON_KEY` / `SERVICE_ROLE_KEY` whose signature is over
   the demo `JWT_SECRET`. Operators who change `JWT_SECRET` (which
   they must) but forget to re-sign get silent 401s everywhere. The
   installer has to do this for them. Doing it in pure bash means
   pulling `jq` + a base64url shim; doing it on the host requires
   Python or Node. The cleanest answer is to run it inside a
   throwaway `python:3.12-alpine` container — `docker` is already a
   hard dep, so the installer has zero extra language deps.

## Decision

- **Pinning.** Check in `docker/supabase/PIN` (a single line, currently
  `v1.24.09`) and `docker/supabase/fetch.sh`. The fetcher pulls the
  GitHub source tarball for that tag and extracts only the `docker/`
  subtree into `docker/supabase/upstream/`. A marker file
  `.fetched-ref` records the version and short-circuits the next run.
  The upstream tree itself is gitignored.

- **Merging.** `docker/kaban-stack.yml` uses Compose's `include:` to
  layer in `./supabase/upstream/docker/docker-compose.yml` and
  `./docker-compose.yml`, with a tiny `services.web` override block to
  add `depends_on: kong` and rewire `NEXT_PUBLIC_SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` to the upstream-managed secrets. No fork
  of upstream — the entire pin is one editable line.

- **First-boot migrations.** `docker/bootstrap.sh` polls
  `docker compose ps`'s health column for the `db` service, then
  `psql`s every file under `supabase/migrations/` with `ON_ERROR_STOP=1`.
  A `.bootstrap-done` marker in `docker/` skips re-application unless
  `--force` is passed. Migrations are already idempotent
  (`if not exists` / `or replace`) so a `--force` run is safe.

- **Installer.** `scripts/install-kaban.sh` is the `curl | sh`
  one-liner. It: (a) sanity-checks docker / compose v2.20+ / curl /
  openssl / tar, (b) clones or pulls the repo, (c) DNS pre-flight
  (`getent hosts` → compare to `ifconfig.me`; skipped for `localhost`),
  (d) generates `docker/.env` with fresh `POSTGRES_PASSWORD` /
  `JWT_SECRET` / `DASHBOARD_PASSWORD` and JWTs signed against that
  secret (containerised Python), (e) runs the supabase fetcher, (f)
  `docker compose pull` + `up -d --build` against `kaban-stack.yml`,
  (g) runs `bootstrap.sh`. Re-runnable on the same host as the upgrade
  path.

- **`docker/.env.example`** expanded to include every variable the
  upstream Supabase compose reads (POSTGRES_*, ANON_KEY,
  SERVICE_ROLE_KEY, JWT_SECRET, DASHBOARD_*, KONG_*, GoTrue / SMTP /
  Studio / Functions / Analytics). The installer writes a real `.env`
  from this template; the file documents every knob for the by-hand
  path.

## Alternatives considered

- **Vendor upstream into git.** Rejected. The compose is a moving
  target — every Supabase release bumps the image tags. A pin + fetch
  is reproducible and trivial to bump.
- **Git submodule for upstream.** Rejected. Submodules need an init
  step and don't sparse-checkout — we'd pull the whole Supabase repo
  (≈ 200 MB) just to use the `docker/` subtree. A pinned tarball is
  ~600 KB.
- **`docker compose -f a.yml -f b.yml` chain instead of `include:`.**
  Works on older Compose, but pushes the file chain into every
  operator command. `include:` makes `kaban-stack.yml` self-contained
  at the cost of requiring Compose v2.20+ (released mid-2024).
- **Sign JWTs in pure bash.** Possible with `openssl dgst -sha256
  -hmac` + a hand-rolled base64url shim, but ugly and easy to get
  wrong. The `python:3.12-alpine` container is ~50 MB and runs in
  ~3 s.
- **Vendor the JWT generator as a tiny binary.** Premature
  optimisation; the installer runs at most once per upgrade.

## Verified

- `bash -n` on `fetch.sh`, `bootstrap.sh`, `install-kaban.sh` —
  clean.
- `fetch.sh` exercised end-to-end against the real GitHub tarball:
  unpacks `supabase/supabase@v1.24.09 docker/` into
  `upstream/docker/` (`docker-compose.yml`, `volumes/`, etc.) and
  writes the `.fetched-ref` marker. Re-running is a no-op.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (29 passing), `pnpm
  build` — all green; bundles unchanged (`/b/[id]/c/[cardId]` 161 kB,
  `/sign-in` 116 kB, `/b/[id]` 197 kB).
- End-to-end `docker compose up` against `kaban-stack.yml` was **not**
  run — no Docker daemon in this harness. The script syntax is
  verified, the upstream tag exists and unpacks correctly, and the
  `include:`-merged compose conforms to upstream's expectations. A
  fresh-VPS dry run is the remaining Phase 7 follow-up.

## Consequences

- An operator with a fresh Ubuntu VPS, Docker installed, and a DNS A
  record can now stand up a private Kaban + Supabase in one command.
- Re-pinning Supabase is a single-file edit (`docker/supabase/PIN`)
  plus a re-run of the installer.
- The installer is opinionated about secrets: it writes them to
  `docker/.env` and tells the operator to back that file up. Losing
  `JWT_SECRET` means every issued session token is dead; losing
  `POSTGRES_PASSWORD` means manual recovery from a backup.
- We've added a soft dependency on Docker Compose v2.20+ via
  `include:`. Older Compose silently ignores `include:` and would
  start only the kaban-web + caddy services — the installer warns on
  version mismatch but doesn't hard-fail (some package managers ship
  early-2.x with cherry-picked include: support).
