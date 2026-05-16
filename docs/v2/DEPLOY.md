# Deploy

If a normal person can't follow the user path in one step, it is not
done. The user path, the dev path, and the CI path are the **same
process** — they differ only by config.

## User install (one step)

One container, one volume, one command:

```
docker run -d \
  -p 80:3000 \
  -v kpu-data:/data \
  -e APP_URL=http://localhost \
  ghcr.io/<org>/kanban-plus-ultra:latest
```

That's it. There is no compose file to edit, no second service, no
gateway, no `.env` to assemble. The image:

- creates / migrates the SQLite file under `/data` on boot;
- generates a `SESSION_SECRET` into the data volume on first boot if one
  isn't supplied (so the user need not invent one);
- serves the app on `:3000`.

Open `APP_URL`, claim the instance (set admin name + password), create an
invite link, send it to a friend. Done.

**Notes**
- `APP_URL` must be the URL users actually type. It is used only for
  invite links and the session cookie — there is no internal-vs-external
  URL to reconcile.
- For HTTPS, the operator may put any TLS terminator in front and set
  `APP_URL=https://…`. The terminator is the operator's choice and is
  irrelevant to app correctness.
- Backup = stop or snapshot, then copy the single SQLite file out of the
  volume. Restore = copy it back.

## Hosted

Identical image. Set `APP_URL` to the public origin, point
`DATABASE_PATH` at the hosted volume, supply `SESSION_SECRET`. No fork,
no extra topology.

## Dev run (one command)

```
pnpm install && pnpm dev
```

Brings the *entire* system up — because the entire system is one process
plus a file. SQLite migrates on boot. No services to start.

## CI runs the same path

CI does not simulate a different topology. It:

1. builds the same image / app,
2. starts it exactly as a user would,
3. runs the **one** Playwright critical-path E2E headless against it,
4. runs `typecheck`, lint, and that one test,

on **every push**. There is no operator-only surface, so there is
nothing CI can't exercise. (This is the explicit countermeasure to v1's
broken feedback loop.)

## Supported runtime / OS matrix

- **Container runtime:** Docker (or a compatible OCI runtime) on Linux,
  macOS, or Windows via WSL2. This is the supported way to run it.
- **Dev:** Node LTS + pnpm on Linux or macOS; Windows via WSL2.

We document this matrix; we do **not** contort code or the installer to
paper over native-Windows / Git-Bash path quirks. Use WSL2 on Windows.
