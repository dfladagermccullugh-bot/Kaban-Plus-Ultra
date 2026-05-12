# Architecture

## High-level

```
                    ┌─────────────────────────────────────────┐
                    │            Kaban Plus Ultra             │
                    └─────────────────────────────────────────┘
                                       │
       ┌───────────────────┬───────────┴───────────┬───────────────────┐
       ▼                   ▼                       ▼                   ▼
  ┌──────────┐       ┌──────────┐            ┌──────────┐        ┌──────────┐
  │ Web      │       │ iOS      │            │ Android  │        │ Self-host│
  │ Vercel   │       │ Capacitor│            │ Capacitor│        │ Docker   │
  │ + PWA    │       │ + Xcode  │            │ + Studio │        │ Compose  │
  └────┬─────┘       └────┬─────┘            └────┬─────┘        └────┬─────┘
       │                  │                       │                   │
       └──────────────────┴───────────┬───────────┴───────────────────┘
                                       │
                              ┌────────▼─────────┐
                              │ Supabase         │
                              │  • Postgres 16   │
                              │  • Auth          │
                              │  • Realtime      │
                              │  • Storage (S3)  │
                              │  • Edge Functions│
                              └──────────────────┘
```

## Stack (locked)

### Web (the primary surface; mobile is a wrapper)

- **Next.js 15** (App Router) + **React 19** + **TypeScript** strict
- **Tailwind CSS 4** for styling, **shadcn/ui** (Radix primitives) for accessible components
- **Framer Motion** for spring-physics animations
- **dnd-kit** for drag-and-drop (touch-friendly; never `react-dnd`)
- **TanStack Query** for server state + optimistic mutations
- **Zustand** for ephemeral UI state (drag preview, modal stack, selection)
- **Tiptap** (ProseMirror) for the markdown editor, with markdown serializer
- **next-pwa** for installability + offline shell

### Backend

- **Supabase** all-in-one: Postgres 16 + Auth + Realtime + Storage + Edge Functions
- **Row-Level Security (RLS)** is the authorization model. Always.
- **Edge Functions** for: share-link issuance, image post-processing trigger, markdown export bundling

### Mobile

- **Capacitor 6** wraps the web app (Next.js static export + native shell)
- Plugins: `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/preferences`, `@capacitor/haptics`, `@capacitor/push-notifications`
- iOS: Xcode (Apple Developer Program, $99/yr) → TestFlight → App Store
- Android: Android Studio (Play Console, $25 one-time) → Internal Testing → Production

### Tooling

- **pnpm** workspaces + **Turborepo** for monorepo orchestration + remote cache
- **Biome** as formatter + linter (replaces ESLint + Prettier)
- **Vitest** + **Testing Library** for unit/component tests
- **Playwright** for E2E (web + mobile viewports)
- **GitHub Actions** for CI; Vercel preview deployments per PR

### Observability

- **Sentry** (web + native via Capacitor plugin)
- Vercel Analytics for web vitals
- Supabase logs + alerts

## Repository layout

```
kaban-plus-ultra/
├── apps/
│   ├── web/                 # Next.js 15 app — the primary product
│   └── mobile/              # Capacitor shell (ios/, android/, capacitor.config.ts)
├── packages/
│   ├── ui/                  # shadcn-based component library (shared)
│   ├── core/                # board/card domain logic, markdown serdes, dnd helpers, fractional indexing
│   ├── db/                  # Supabase client, generated types, RLS policy SQL
│   └── config/              # tailwind preset, tsconfig base, biome config
├── supabase/
│   ├── migrations/          # timestamped SQL migrations
│   ├── seed.sql             # demo board for new accounts
│   └── functions/           # edge functions
├── docker/
│   ├── docker-compose.yml   # self-host bundle
│   └── README.md
├── docs/                    # this folder
├── .github/workflows/
├── CLAUDE.md                # session entry point
├── README.md
└── package.json             # pnpm workspace root
```

## Runtime topology

### Cloud (default)

| Concern | Service |
|---|---|
| Web hosting | Vercel (Edge + Node runtimes) |
| DB + Auth + Realtime + Storage | Supabase Cloud |
| Image delivery | Supabase Storage (CDN-fronted post-v1) |
| Email (magic links) | Supabase Auth's built-in provider, or Resend |
| Error tracking | Sentry |

### Self-host (`docker compose up`)

| Concern | Container |
|---|---|
| Supabase stack | official `supabase/postgres`, `gotrue`, `postgrest`, `realtime`, `storage-api` |
| Web app | `kaban-web` (Next.js standalone build) |
| Reverse proxy + TLS | `caddy` (Let's Encrypt) |
| Email | bring-your-own SMTP (configured via `.env`) |

See `SELF_HOSTING.md` for the user-facing guide.

## Data flow (writes)

1. User drags a card from cell A → cell B.
2. Web client computes new `position` via fractional indexing (`packages/core/ordering.ts`).
3. TanStack Query mutation calls Supabase JS client → `UPDATE cards SET row_id, column_id, position`.
4. RLS verifies the user is owner or editor on the board.
5. Postgres emits a logical replication event.
6. Supabase Realtime broadcasts to all subscribers of `board:{id}`.
7. Other clients update local cache; Framer Motion `layoutId` animates the card to its new cell.

## Auth flow

1. User enters email or clicks "Continue with Google".
2. Supabase issues a session (cookie on web, Capacitor Preferences on mobile).
3. SQL trigger `on_auth_user_created` inserts a `profiles` row + seeds a demo board.
4. All subsequent reads/writes are RLS-gated by `auth.uid()`.

## Realtime channels

- `board:{id}` — `cards`, `rows`, `columns`, `labels` table changes (INSERT / UPDATE / DELETE)
- `presence:{id}` — heartbeat with `{ profile_id, cursor_x, cursor_y, focused_card_id }`

## Non-negotiable invariants

- **No service-role keys in the client.** Period. Server-only routes that need elevation use `@/lib/supabase/admin` and are explicitly enumerated in `docs/SECURITY.md`.
- **Every ordered list uses fractional indexing.** No `ORDER BY id` ever for user-visible order.
- **Every write goes through TanStack Query mutations** with optimistic update + rollback on error. No raw `fetch` from components.
- **Every UI uses tokens.** No hex literals in JSX. The Tailwind preset is the single source of truth.

See `DESIGN_SYSTEM.md`, `DATA_MODEL.md`, and `SECURITY.md` for the details that hang off this architecture.
