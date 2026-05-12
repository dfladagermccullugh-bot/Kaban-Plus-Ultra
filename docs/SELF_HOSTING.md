# Self-Hosting Kaban Plus Ultra

> Status: **stub.** Full instructions land in Phase 7. This document records the
> intended setup so the implementation has a target to hit.

## Goal

`docker compose up` on any Linux box with Docker + a public IP gives you a
working KPU instance with TLS in under 10 minutes.

## Prereqs

- Linux host (any distro with Docker 24+)
- A domain pointing to the host (`A` record)
- 25 outbound port reachable (or an SMTP relay) for magic-link emails
- 2 GB RAM minimum, 4 GB recommended

## Files

```
docker/
├── docker-compose.yml          # supabase + kaban-web + caddy
├── Caddyfile                   # TLS + reverse proxy config
├── .env.example                # all envs you'll need
└── volumes/                    # bind mounts for postgres, storage, caddy data
```

## Setup outline (Phase 7 will turn this into runnable steps)

1. Clone the repo and `cd docker/`.
2. Copy `.env.example` → `.env`. Fill in:
   ```
   DOMAIN=kaban.example.com
   POSTGRES_PASSWORD=<long random>
   JWT_SECRET=<long random>
   ANON_KEY=<derived from JWT_SECRET>
   SERVICE_ROLE_KEY=<derived from JWT_SECRET>
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_USER=<your sender>
   SMTP_PASS=<your password>
   SITE_URL=https://kaban.example.com
   ```
3. `docker compose up -d`.
4. Visit `https://kaban.example.com`. Caddy fetches a Let's Encrypt cert on first request.
5. First-run wizard: create the initial admin account (an email + password — admin override only; everyone else gets magic-link auth).

## Containers

| Service | Image | Notes |
|---|---|---|
| `db` | `supabase/postgres:<pinned>` | bind mount `volumes/db` |
| `auth` | `supabase/gotrue:<pinned>` | env-driven |
| `rest` | `postgrest/postgrest:<pinned>` | |
| `realtime` | `supabase/realtime:<pinned>` | |
| `storage` | `supabase/storage-api:<pinned>` | bind mount `volumes/storage` |
| `kong` | `kong:<pinned>` | API gateway in front of the above |
| `kaban-web` | local build from `apps/web` standalone output | `next start -p 3000` |
| `caddy` | `caddy:2-alpine` | TLS + reverse proxy |

## Backups

- Recommended: nightly `pg_dump` to an object store (B2 / R2 / S3).
- Storage volume backed up the same way (rsync or `restic`).
- Example cron in `docker/backup.sh` (added in Phase 7).

## Updating

```bash
git pull
docker compose pull
docker compose up -d
```

Migrations apply automatically on `kaban-web` boot (idempotent).

## Troubleshooting

(filled in during Phase 7 once a fresh VPS install is tested end-to-end)
