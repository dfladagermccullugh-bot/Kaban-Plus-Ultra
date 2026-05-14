# Self-hosting Kaban Plus Ultra

KPU ships as a Docker image plus a Caddy reverse proxy. The database is
Postgres + Supabase; you can either point at hosted Supabase or run the
official Supabase self-host stack alongside.

This doc covers the **Phase 7 kickoff** path: enough to bring up a single
VPS that serves `https://kaban.your-domain.com` against a Supabase you
already own. The polished single-tarball / one-liner installer lands
later in Phase 7.

## TL;DR

The fully-bundled, one-liner path (recommended):

```sh
curl -fsSL https://raw.githubusercontent.com/dfladagermccullugh-bot/kaban-plus-ultra/main/scripts/install-kaban.sh \
  | KABAN_HOST=kaban.example.com sh
```

That script clones the repo into `~/kaban-plus-ultra`, runs a DNS
pre-flight against `$KABAN_HOST`, generates `docker/.env` with fresh
random secrets + signed JWTs, fetches the upstream Supabase compose at
the pinned tag (`docker/supabase/PIN` — currently `v1.24.09`), pulls
every image, brings up the merged stack, and applies
`supabase/migrations/*.sql` once Postgres is healthy. Re-running the
script on the same host is the upgrade path.

The hand-rolled path (also supported):

```sh
cp docker/.env.example docker/.env       # then edit
cd docker && docker compose up -d --build
```

Caddy provisions a Let's Encrypt cert for `$KABAN_HOST` automatically.
Once the stack is up, the installer prints a one-time
`https://$KABAN_HOST/setup?t=<token>` URL — open it in a private window
to claim the workspace owner account. After that, sign in normally with
a magic link.

## Prereqs

- Docker Engine ≥ 24 with the Compose plugin.
- A DNS A/AAAA record for `$KABAN_HOST` pointing at the host's public IP
  (skip for a localhost-only run; Caddy falls back to a self-signed
  cert).
- A Supabase project — see "Provisioning Supabase" below.
- ≥ 1 GB RAM free for the build; ≥ 512 MB for the runtime container.

## Files

```
docker/
├── Dockerfile.web         # multi-stage Next.js standalone build
├── docker-compose.yml     # kaban-web + caddy (hosted-Supabase path)
├── kaban-stack.yml        # ^^ merged with upstream Supabase (full self-host)
├── bootstrap.sh           # waits for Postgres, applies migrations via psql
├── Caddyfile              # TLS + reverse proxy config
├── .env.example           # all envs you'll need
└── supabase/
    ├── PIN                # pinned upstream tag (currently v1.24.09)
    ├── fetch.sh           # downloads supabase/supabase@$PIN docker/ subtree
    ├── README.md
    └── upstream/          # gitignored; populated by fetch.sh
scripts/
└── install-kaban.sh       # the curl | sh one-liner installer
```

## Provisioning Supabase

Pick **one** of the two paths.

### Path A — Hosted Supabase (simplest)

1. Create a project at <https://supabase.com> (or `supabase projects
   create` via the CLI).
2. Copy these into `docker/.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`      — project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon (publishable) key
   - `SUPABASE_SERVICE_ROLE_KEY`     — service-role key (server-only;
     never shipped to the browser)
3. Apply the migrations:
   ```sh
   supabase link --project-ref <ref>
   supabase db push                   # applies supabase/migrations/*
   ```
   …or run each `supabase/migrations/00*.sql` via `psql` against the
   project's connection pooler.

### Path B — Self-hosted Supabase (merged stack)

This is the path the `install-kaban.sh` one-liner takes. By hand:

1. Pin + fetch the upstream Supabase compose. We pin to
   [`docker/supabase/PIN`](../docker/supabase/PIN) (currently
   `v1.24.09`):
   ```sh
   ./docker/supabase/fetch.sh                     # populates docker/supabase/upstream/
   ```
2. Generate `docker/.env`. Either copy `.env.example` and fill in
   every secret by hand, or let the installer do it:
   ```sh
   KABAN_HOST=kaban.example.com ./scripts/install-kaban.sh
   ```
   The installer signs anon + service-role JWTs from a fresh
   `JWT_SECRET` so the two `eyJ...` keys in `.env` are mutually
   consistent with the secret the Supabase containers read.
3. Bring everything up (merged kaban-web + caddy + supabase) via
   `kaban-stack.yml`, which uses `include:` to pull in the upstream
   compose without forking it:
   ```sh
   cd docker && docker compose -f kaban-stack.yml up -d --build
   ```
4. Apply the Kaban migrations. The `bootstrap.sh` script waits for the
   Postgres container to report healthy, then `psql`s in every file in
   `supabase/migrations/`:
   ```sh
   ./docker/bootstrap.sh                          # idempotent; --force to re-run
   ```

After first boot you can re-run `install-kaban.sh` to update — the
script preserves `docker/.env`, re-fetches the upstream pin only on a
PIN change, and only restarts services whose images or env actually
changed.

Either path produces the same schema: 10 public tables, 3 storage
buckets, RLS on every public table, and the `supabase_realtime`
publication carrying the per-board mutable child tables.

## Bringing the app up

```sh
cd docker
docker compose build web         # ~3 min on first run, cached after
docker compose up -d
docker compose logs -f web caddy
```

Health-check:

```sh
curl -sf https://$KABAN_HOST/ -o /dev/null && echo OK
```

## SMTP for magic links

Supabase Auth sends magic links via SMTP. In hosted mode, configure SMTP
under **Authentication → Email Templates / SMTP Settings**. In self-host
mode, point Supabase's `GOTRUE_SMTP_*` env vars at your provider
(Postmark, Resend, Mailgun, …) — or run [Inbucket][inbucket] locally to
grab the links from a web UI.

[inbucket]: https://github.com/inbucket/inbucket

## Updating

```sh
git pull
cd docker
docker compose build web
docker compose up -d web
```

Caddy doesn't need to restart for app updates. For schema changes, apply
any new files in `supabase/migrations/`.

## Backups

### Postgres

**Path A (hosted Supabase)** — Supabase runs managed backups for you;
see Project Settings → Database → Backups.

**Path B (bundled self-host)** — `kaban-stack.yml` ships a
`db-backup` side-car that runs `pg_dumpall` on a schedule and writes
gzipped dumps to `docker/backups/` on the host.

The defaults (configurable via `docker/.env`):

| Var | Default | Meaning |
| --- | --- | --- |
| `BACKUP_INTERVAL_SECONDS` | `86400` (daily) | Sleep between dumps. |
| `BACKUP_RETENTION_DAYS`   | `14`            | Delete dumps older than N days. `0` = forever. |

The container reports unhealthy if no fresh dump has landed in
`2 × BACKUP_INTERVAL_SECONDS`, so `docker compose ps` surfaces silent
failures.

Restore a dump (run from the `docker/` directory):

```sh
gunzip -c backups/kaban-<timestamp>.sql.gz \
  | docker compose -f kaban-stack.yml exec -T db \
      psql -U postgres -v ON_ERROR_STOP=1
```

`pg_dumpall --clean --if-exists` drops and recreates every database
before the data load, so the restore is destructive — schedule
downtime first. Ship the gz files off-host (B2 / R2 / S3 nightly cron,
`restic`, etc.) for proper disaster recovery; the side-car only
guarantees *on-host* durability.

To disable the side-car for a deploy: `docker compose -f
kaban-stack.yml stop db-backup` (it won't auto-restart until you
`start` it again or recreate the stack).

### Storage

The `card-images`, `avatars`, and `exports` buckets live in Supabase
Storage. Hosted Supabase backs these up alongside Postgres; on the
bundled self-host stack they're written under
`docker/supabase/upstream/docker/volumes/storage/` on the host —
include that path in your off-host backup cron.

## ARM64 / Raspberry Pi

`docker/Dockerfile.web` declares `--platform=$TARGETPLATFORM` on every
stage so a single Dockerfile builds for either `linux/amd64` or
`linux/arm64` (no separate `Dockerfile.arm`). To build a single
image that ships for both:

```sh
./scripts/build-multiarch.sh --push -t ghcr.io/<you>/kaban-web:0.7
```

The script creates a `kaban-builder` `docker-container` buildx builder
the first time it runs, registers QEMU binfmt handlers via
`tonistiigi/binfmt --install all`, then drives `docker buildx build
--platform linux/amd64,linux/arm64`. Without `--push` a multi-arch
build is `--output=type=cacheonly` because Docker has no local registry
for manifest lists; for a host-arch-only smoke build pass
`PLATFORMS=linux/arm64 ./scripts/build-multiarch.sh` (or `linux/amd64`).

Native ARM64 builds (running directly on a Pi 4 / 5) just use plain
`docker compose -f kaban-stack.yml up -d --build` — `node:22-alpine`,
`postgres:17-alpine`, and the upstream Supabase images all publish
multi-arch manifests, and `--platform=$TARGETPLATFORM` makes buildkit
pick the right native base.

## First-run wizard

A fresh `install-kaban.sh` deploy starts with an empty `profiles` table
and no way to sign up — sign-ups create profiles via the trigger but
require an SMTP server to receive the magic link. To bootstrap the
first account, the installer prints a one-time URL:

```
https://$KABAN_HOST/setup?t=<SETUP_TOKEN>
```

`SETUP_TOKEN` is a 32-char random string written into `docker/.env` at
install time and never reused. The `/setup` route is **only** reachable
when (a) the request supplies a matching `?t=`, AND (b) the `profiles`
table is empty. Any other request 404s, so the URL is safe to log.

The wizard collects email + display name + accent color + optional
avatar, then uses the Supabase auth admin API to create the user with
`email_confirm: true` and surfaces a single-use magic-link inline (SMTP
isn't required for first-run). Once a profile exists, `/setup`
self-disables — the next visit lands on a "Setup is complete" page.

To re-run the wizard (e.g. fresh start after accidentally claiming the
wrong email), delete the user out of band:

```sh
docker compose -f kaban-stack.yml exec db psql -U postgres -c \
  "delete from auth.users where email = 'wrong@example.com';"
```

The trigger cascades the delete to `profiles` and the user's demo
board. Then visit `/setup?t=<token>` again.

## Phase 7 follow-ups (not yet shipped)

- End-to-end fresh-VPS dry run of `install-kaban.sh` (needs a Docker
  host outside this harness).
- Optional Sentry / Plausible side-cars.
