# `docker/supabase/`

This directory pins the upstream Supabase self-host compose into the Kaban
self-host bundle. The pin is a single line in [`PIN`](./PIN). Current value:
`v1.24.09` — the last Supabase self-host tag with all images frozen at
specific date-pinned SHAs (see the `image:` lines under each service).

## Files

```
PIN          # the upstream tag to pull (one line, e.g. v1.24.09)
fetch.sh     # downloads supabase/supabase@$PIN docker/ subtree -> ./upstream/
upstream/    # gitignored; created by fetch.sh; contains docker-compose.yml + volumes/
```

## Use

From the repo root:

```sh
./docker/supabase/fetch.sh
```

Then bring the merged stack up with `docker/kaban-stack.yml` (which
`include:`s the upstream compose from `./supabase/upstream/docker/`):

```sh
cd docker && docker compose -f kaban-stack.yml up -d
```

## Bumping the pin

1. Pick a new tag from <https://github.com/supabase/supabase/tags>. Look for
   tags with a `docker/docker-compose.yml` whose `image:` lines are date-
   pinned (not `:latest`).
2. Edit `PIN` to the new tag.
3. Re-run `./fetch.sh`. The marker `.fetched-ref` in `upstream/` is checked
   on every boot; a mismatch triggers a re-fetch.
4. Bring the stack down (`docker compose down`), then up. Apply any new
   migrations the upstream stack expects.

## Why not vendor the upstream compose into git?

The upstream `docker-compose.yml` bind-mounts roughly 30 files from a sibling
`volumes/` tree (Postgres init scripts, Kong config, vector config, …).
Vendoring the whole tree would mean forking it — the moment you touch one
file the pin becomes a fiction. A pinned tag + tarball fetch keeps drift
impossible by construction.
