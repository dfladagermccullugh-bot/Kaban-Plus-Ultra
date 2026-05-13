# Self-hosting Kaban Plus Ultra

KPU ships as a Docker image plus a Caddy reverse proxy. The database is
Postgres + Supabase; you can either point at hosted Supabase or run the
official Supabase self-host stack alongside.

This doc covers the **Phase 7 kickoff** path: enough to bring up a single
VPS that serves `https://kaban.your-domain.com` against a Supabase you
already own. The polished single-tarball / one-liner installer lands
later in Phase 7.

## TL;DR

```sh
cp docker/.env.example docker/.env       # then edit
cd docker && docker compose up -d --build
```

Caddy provisions a Let's Encrypt cert for `$KABAN_HOST` automatically.
Browse to `https://$KABAN_HOST/` and sign in with a magic link.

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
├── docker-compose.yml     # web + caddy (supabase optional/external)
├── Caddyfile              # TLS + reverse proxy config
└── .env.example           # all envs you'll need
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

### Path B — Self-hosted Supabase

1. Clone the upstream compose alongside ours:
   ```sh
   git clone --depth 1 https://github.com/supabase/supabase.git supabase-stack
   ```
2. Follow the Supabase self-host quickstart to set its `JWT_SECRET`,
   `POSTGRES_PASSWORD`, `ANON_KEY`, `SERVICE_ROLE_KEY`, etc. — both in
   `supabase-stack/docker/.env` and (matching) in `docker/.env`. Use
   that stack's gateway URL as `NEXT_PUBLIC_SUPABASE_URL` (typically
   `http://kong:8000` when the two stacks share a Docker network, or
   `https://supabase.your-domain.com` if you front Supabase with its own
   Caddy block).
3. Bring everything up:
   ```sh
   (cd supabase-stack/docker && docker compose up -d)
   (cd docker                 && docker compose up -d --build)
   ```
4. Apply the KPU migrations into the self-hosted DB:
   ```sh
   for f in supabase/migrations/*.sql; do
     docker compose -f supabase-stack/docker/docker-compose.yml \
       exec -T db psql -U postgres -d postgres < "$f"
   done
   ```

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

- **Postgres** — nightly `pg_dump` piped into an S3-compatible bucket
  (B2 / R2 / S3). Path A: use Supabase's managed backups. Path B: add a
  `restic` or `pgbackrest` side-car to your compose.
- **Storage** — the `card-images` and `exports` buckets live in Supabase
  Storage; the same backup story applies.

## Phase 7 follow-ups (not yet shipped)

- Single `kaban-stack.yml` that pulls in the upstream Supabase compose
  pinned to a known-good tag.
- One-liner `curl ... | sh` installer that does DNS pre-flight + compose
  pull + first-boot migrations.
- Healthchecked Postgres backups baked in.
- Optional Sentry / Plausible side-cars.
- ARM64 multi-arch image for Raspberry-Pi-class hosts.
