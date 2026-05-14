# 0017. ARM64 multi-arch build + Postgres backup side-car

- **Date**: 2026-05-14
- **Status**: accepted

## Context

Phase 7 left two open polish items in `docs/ROADMAP.md` / `docs/SELF_HOSTING.md`:

1. **ARM64 multi-arch image** so a single `kaban-web` tag runs on a
   Raspberry-Pi-class home server (the original "Trello at home" use
   case from `docs/VISION.md`) as well as commodity amd64 VPS hosts.
2. **Healthchecked Postgres backups baked in** so an operator who runs
   the one-liner installer doesn't have to roll their own `pg_dump`
   cron. The previous SELF_HOSTING note said "add `restic` or
   `pgbackrest` as a side-car" — fine for a sysadmin, hostile for the
   "deploy and forget" path the installer markets.

Both are deliberately small additions on top of the merged
`kaban-stack.yml` (ADR 0015) — we don't fork upstream Supabase and we
don't pull in a new third-party image where a stock one will do.

## Decision

### Multi-arch

- `docker/Dockerfile.web` gets `ARG TARGETPLATFORM` / `ARG BUILDPLATFORM`
  and every `FROM` line becomes `FROM --platform=$TARGETPLATFORM
  node:22-alpine`. `node:22-alpine` is itself a multi-arch manifest, so
  buildkit picks the right native base per target without us
  cross-compiling by hand.
- A new `scripts/build-multiarch.sh` wraps `docker buildx build
  --platform linux/amd64,linux/arm64`. On first run it creates a
  `kaban-builder` `docker-container` builder (the default `docker`
  driver can't push multi-arch manifests), then `docker run --privileged
  --rm tonistiigi/binfmt --install all` to register QEMU binfmt
  handlers idempotently. Without `--push` a multi-platform build is
  forced to `--output=type=cacheonly` because Docker has nowhere to
  store a manifest list locally.
- Operators on an actual ARM64 host (Pi 4 / 5, Ampere VPS, Apple Silicon
  + Docker Desktop) don't need the buildx script — plain `docker
  compose -f kaban-stack.yml up -d --build` already produces a native
  arm64 image because of the `--platform=$TARGETPLATFORM` hint.

### Postgres backups

- A new `db-backup` service in `kaban-stack.yml` running stock
  `postgres:17-alpine` (gives us `pg_dumpall` + `gzip` without a custom
  image). Two scripts are bind-mounted in: `docker/backup/run.sh` (the
  dump loop) and `docker/backup/healthcheck.sh` (the freshness check).
- Loop: `pg_dumpall --clean --if-exists | gzip -9 > backups/kaban-<ts>.sql.gz`,
  rotate with `find -mtime +N -delete`, sleep, repeat. The first dump
  runs at boot so the healthcheck has a marker file before
  `start_period` expires.
- Healthcheck flips unhealthy if `backups/.last-ok` is older than
  `2 × BACKUP_INTERVAL_SECONDS`. Two intervals tolerates one missed
  cycle (db was restarting during a dump) before paging the operator
  via `docker compose ps`.
- Bind-mounted to `./backups` on the host (gitignored) so dumps survive
  `docker compose down -v` and ship-off-host scripts can rsync them
  directly without `docker cp`.
- Two new env knobs (`BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`)
  with sensible defaults (daily / 14 days) so the bundled stack works
  with zero env tweaks.

## Alternatives considered

- **`prodrigestivill/postgres-backup-local` for the backup side-car.**
  Well-known, multi-arch, healthchecked. Rejected because it's a
  third-party image to vendor into a "trust me, run my curl|sh"
  installer, and `pg_dumpall | gzip` in 30 lines of shell is auditable
  by anyone who reads the repo.
- **`pgbackrest` side-car.** More powerful (PITR, parallel restores,
  S3-native) but considerable operator overhead — stanzas, archive
  modes, retention policies. Overkill for v1. Documented in
  SELF_HOSTING.md as "ship the gz files off-host" — operators who want
  PITR can layer pgbackrest on top.
- **Stream backups directly to S3/B2/R2 from the side-car.** Tempting,
  but the installer would need credentials at install time and we'd
  bake `aws-cli` / `rclone` into the image. Cleaner separation: the
  side-car guarantees on-host durability; off-host ship-out is a cron
  the operator writes once.
- **Cross-compile (not emulate) for ARM64 via Docker's `--platform`
  + Node's prebuilt binaries.** Works for pure-JS code but `sharp`
  ships per-arch native bindings and `pnpm install` fetches them based
  on the build host's arch unless we set `npm_config_arch`. QEMU
  emulation under buildx Just Works at the cost of a slower build —
  acceptable for an image people rebuild on schema bumps, not every
  commit.
- **Two separate Dockerfiles (`Dockerfile.web.amd64`, `…arm64`).**
  Avoids QEMU but doubles maintenance. `--platform=$TARGETPLATFORM` is
  the modern answer.

## Consequences

**Easier**

- A Pi-class home server now runs the same image tag as a $5 amd64
  VPS. The "Trello at home" pitch is literally one `docker compose up`
  away on hardware most of the target audience already owns.
- Fresh `install-kaban.sh` deploys get a working backup story for free
  — no operator action, no separate cron to remember.
- Restore is one shell command, documented inline in
  `kaban-stack.yml` next to the side-car definition.

**Harder**

- Multi-arch buildx requires Docker Engine ≥ 24 with the `buildx`
  plugin and binfmt registration — extra deps for the publish path.
  The script handles both automatically and falls back gracefully when
  only a single platform is requested.
- The backup side-car is best-effort: it guarantees a fresh gz on
  local disk but not off-host durability. The docs spell this out;
  pretending otherwise would be a worse outcome than honest scope.
- Compose v2.20+ is still required (for `include:`, unchanged from
  ADR 0015).

**To watch**

- `pg_dumpall` against a multi-GB instance is slow and locks shared
  catalogs for the duration. If KPU ever has users running dumps
  bigger than a few hundred MB on small hosts, swap to `pg_dump
  --format=directory --jobs=N` per-database and revisit retention.
- The backup volume bind-mounts to `./backups`; on hosts running
  AppArmor / SELinux with the wrong context, postgres-alpine may not
  be able to write there. Tracked as a doc note; not worth a named
  volume + extra ship-out step for v1.
