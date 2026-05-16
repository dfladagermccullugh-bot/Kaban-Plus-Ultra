# Architecture

The whole system is **one process and one file**. That is the
architecture; everything below justifies why nothing more is needed.

## The single-origin guarantee (the core design)

The browser talks to **exactly one** process over **exactly one** base
URL. That process serves the UI, serves the API, and opens the database
by a **file path** — never by a network origin. There is no second
service, no gateway, no internal-vs-external URL, no reverse proxy
required for correctness.

Consequence: there is nothing to mis-address. The defect class that
sinks self-hosted apps — "which URL does component X think it is?" —
**cannot exist here**, because there is only one component and the
browser only ever knows one URL.

The only place an absolute URL is emitted is an **invite link**. It is
built from a single env var, `APP_URL` (the externally-correct origin the
operator serves on). It is read in exactly one place. There is no
origin-rewrite helper anywhere, and adding one is forbidden — if a design
seems to need one, the design is wrong.

## Components (each justified vs the Prime Directive)

| Component | Choice | Why it survives the Prime Directive |
|---|---|---|
| App | **One Next.js app** (App Router; route handlers / server actions) | One process serves UI + API from one origin. No BFF, no separate API tier, no gateway to misconfigure. |
| Data | **Embedded SQLite** (synchronous driver, e.g. `better-sqlite3`) | One file, zero extra services/containers. A friend group's write volume is trivial. Backups = copy a file. |
| Schema/queries | One lean typed layer + on-boot migrations (recommend Drizzle; Kysely or raw SQL acceptable) | Types + migrations from one source; migrations apply automatically at startup so deploy stays one step. |
| Auth | **First-party**: password hash (argon2 or bcrypt) in the DB; signed, httpOnly cookie session | No identity service, no SMTP, no IdP. Fully testable headless. |
| Card body | **Markdown text** column, rendered client-side with a known sanitizing renderer (e.g. `markdown-it` + DOMPurify, or `react-markdown` + `rehype-sanitize`) | Markdown is the canonical, durable format; render is derived. No serdes library of our own. |
| Drag & drop | One lightweight DnD library (e.g. dnd-kit) | Single dependency, headless-testable, no custom DnD engine. |
| Motion | Framer Motion springs; honor `prefers-reduced-motion` | A felt-quality requirement; one library already in the frontend. |
| Styling | Tailwind theme = the design tokens (see `DATA_MODEL.md` is data; tokens live in the build) | Tokens, never raw values; no second styling system. |

That is the entire moving-parts inventory: **a Node process and a SQLite
file.**

## Rejected heavier alternatives (and why)

- **Postgres / a managed DB / Supabase / PostgREST.** A second service,
  a connection string and origin to get right, heavier dev + CI. SQLite
  delivers the friend-group core with zero extra parts. Rejected.
- **GoTrue / external IdP / OAuth / magic-link email.** Adds an identity
  service or external dependency and (for email) SMTP and an
  origin-in-email failure mode, none headless-testable in one step.
  First-party password + invite tokens does the job. Rejected.
- **Object-storage + image gateway (signed URLs, transform service).**
  An entire second origin and a perennial URL-leak source. v1 does no
  uploads; markdown may link external image URLs. Rejected.
- **Realtime WebSocket service.** A separate, hard-to-headless-test
  surface for a board that changes rarely. Optimistic local updates plus
  refetch-on-focus is enough. Rejected for v1.
- **Reverse proxy / API gateway as a correctness dependency.** Removed by
  the single-origin design. A TLS terminator in front is the operator's
  optional choice and is irrelevant to app correctness.
- **Microservices / separate API server / queue / cache.** No load
  justifies them. Rejected.

## Self-host == hosted

Same image, same code path. The only differences are configuration:

- `APP_URL` — the externally-correct origin (e.g.
  `https://board.example.com` hosted, `http://localhost:3000`
  self-host). Used only for invite links and the session cookie domain.
- A path/volume for the SQLite file.
- The session-signing secret.

Hosted is not a fork and not a different topology — it is this same one
process with those three values set. There is no separate "hosted
backend."

## Configuration surface (the entire list)

- `APP_URL` — externally-correct base origin.
- `DATABASE_PATH` — where the SQLite file lives (defaults to a path
  inside the data volume).
- `SESSION_SECRET` — signs the session cookie.

Three variables. Any addition must be justified against the Prime
Directive in `ARCHITECTURE.md` or it does not ship.
