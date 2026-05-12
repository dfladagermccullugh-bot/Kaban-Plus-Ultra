# Contributing

> Status: **stub.** Most of this lands with the Phase 0 scaffolding commit. The
> conventions below are normative even before the tooling exists.

## Prerequisites

- **Node.js 20+** (use `nvm` or `fnm`)
- **pnpm 9+** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Supabase CLI** (`brew install supabase/tap/supabase` or platform equivalent)
- **Docker** (for `supabase start` locally and self-host testing)
- For mobile (Phase 5+): **Xcode** (macOS) and **Android Studio**

## First-time setup

```bash
git clone <repo>
cd kaban-plus-ultra
pnpm install
cp .env.example .env.local
supabase start                  # spins up local Postgres + Auth + Storage
pnpm db:migrate                 # apply migrations to local supabase
pnpm db:types                   # regenerate TypeScript types
pnpm dev                        # starts apps/web on http://localhost:3000
```

## Common scripts (defined in root `package.json` once scaffolded)

| Command | What |
|---|---|
| `pnpm dev` | Run `apps/web` Next.js dev server |
| `pnpm build` | Production build (turbo orchestrated) |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm test` | Vitest unit + component tests |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm lint` | Biome lint + format check |
| `pnpm format` | Biome format write |
| `pnpm db:migrate` | Apply migrations to local supabase |
| `pnpm db:reset` | Drop + recreate + remigrate (destructive) |
| `pnpm db:types` | Regenerate `packages/db/src/types.ts` |
| `pnpm mobile:ios` | Build web + sync Capacitor + open Xcode |
| `pnpm mobile:android` | Build web + sync Capacitor + open Android Studio |

## Conventions

### Branches

- One branch per feature / phase task.
- `claude/kanban-plus-ultra-dev-VNoFa` is the current dev integration branch for AI sessions.
- `main` is protected; merges via PR only.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(board): add row collapse animation
fix(auth): redirect after magic-link callback
chore(deps): bump tiptap to 2.4.0
docs(roadmap): tick off card editor checkboxes
```

Scope is the package or area (`web`, `core`, `db`, `ui`, `mobile`, `docker`, `docs`, `auth`, `board`, etc.).

### Code style

- TypeScript strict — no `any` (use `unknown` + narrow).
- Functional components only.
- Server Components by default; `'use client'` only when needed (state, refs, browser APIs).
- Tailwind for styles; no CSS files except `globals.css` for the theme.
- Use tokens (`bg-surface`, `text-muted-foreground`) — never raw hex.
- No inline `style={{}}` except for Framer Motion variables.
- Filenames: `kebab-case.ts` for utilities, `PascalCase.tsx` for components.

### Tests

- Component tests live next to the component: `Card.tsx` ↔ `Card.test.tsx`.
- Domain logic (in `packages/core`) has Vitest unit tests required for any branching logic.
- E2E flows go in `apps/web/e2e/`.

### Pull requests

- One logical change per PR. Tiny PRs are encouraged.
- PR title is the commit message format.
- PR description: what, why, how to test.
- Green CI required to merge.

## What lives where (quick reference)

| Layer | Location |
|---|---|
| Routes, pages, route handlers | `apps/web/app/` |
| React components for the web app | `apps/web/components/` |
| App-scoped helpers (env, Supabase clients, auth) | `apps/web/lib/` |
| Auth middleware | `apps/web/middleware.ts` (+ `lib/supabase/middleware.ts`) |
| Shared design-system components | `packages/ui/` |
| Domain logic (board model, markdown, ordering) | `packages/core/` |
| Supabase client + types + RLS policy SQL | `packages/db/` |
| SQL migrations | `supabase/migrations/` |
| Edge Functions | `supabase/functions/` |
| Capacitor shell | `apps/mobile/` |
| Self-host bundle | `docker/` |
| All docs | `docs/` |

## Auth routes (Phase 1)

- `/sign-in` — magic-link form + Google OAuth button (Client Component)
- `/auth/callback` — exchanges Supabase `?code=...` for a session cookie, redirects to `?next=`
- `/sign-out` — POST endpoint; calls `auth.signOut()` then redirects home
- `/profile` — Server Component fetches profile via `getCurrentUser()`; Server Action `updateProfile` saves changes

Use `getCurrentUser()` from `@/lib/auth` in any Server Component that needs the
user. It returns `null` when signed-out **or** when Supabase env is missing
locally, so dev scaffolding doesn't crash.
