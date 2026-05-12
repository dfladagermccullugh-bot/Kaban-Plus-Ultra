# Kaban Plus Ultra — Shared Agent Context

This file is the canonical 60-second briefing for any AI agent (Claude, Codex,
Gemini, etc.) asked to work on this repo. **Read it first, every time.**

Both `CODEX_PRIMER.md` and `GEMINI_PRIMER.md` include this file's content
verbatim — keep it tight and accurate.

## What it is

**Kaban Plus Ultra (KPU)** is a Trello-style board app with a **true 2D
swimlane grid** (rows × columns), markdown cards with inline images, and
per-board sharing. One TypeScript codebase ships to web + iOS + Android via
Capacitor.

The origin story is in `docs/VISION.md` — two friends frustrated with Trello
deciding to build "Trello at home" with real swimlanes.

## Stack at a glance

- **Web**: Next.js 15 (App Router) + React 19 + TypeScript strict
- **Styling**: Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Motion**: Framer Motion (spring physics, not eased tweens)
- **Drag-and-drop**: dnd-kit (touch-friendly; **never** react-dnd)
- **State**: TanStack Query (server cache + optimistic updates), Zustand (UI state)
- **Editor**: Tiptap (ProseMirror) with markdown serializer
- **Backend**: Supabase (Postgres 16, Auth, Realtime, Storage, Edge Functions)
- **Mobile**: Capacitor 6 wraps the web app → iOS + Android
- **Monorepo**: pnpm workspaces + Turborepo
- **Lint/format**: Biome (single tool, replaces ESLint + Prettier)
- **Tests**: Vitest + Testing Library (unit/component), Playwright (E2E)

## Non-negotiables

1. **Simplify, simplify, simplify.** No feature outside `docs/ROADMAP.md`. Anything not on it is a "no."
2. **Springs, not tweens.** Default: `{ type: 'spring', stiffness: 300, damping: 30 }`. Respect `prefers-reduced-motion`.
3. **RLS is sacred.** No `SUPABASE_SERVICE_ROLE_KEY` in client code. Ever.
4. **Fractional indexing** for every ordered list (rows, columns, cards). Helpers in `packages/core/ordering.ts`. Never renumber.
5. **Markdown is canonical** for card bodies. HTML preview is derived.
6. **Tokens, not raw values.** Colors / spacing / radii come from the Tailwind theme — never hex literals in components.
7. **One codebase, three platforms.** Don't fork web/mobile paths unless a Capacitor plugin is genuinely required.

## Repo map (where things live)

- `apps/web/`        — Next.js app: pages, route handlers, components
- `apps/mobile/`     — Capacitor shell (iOS + Android projects)
- `packages/ui/`     — shadcn-based shared component library
- `packages/core/`   — domain logic (board model, markdown serdes, dnd helpers, fractional indexing)
- `packages/db/`     — Supabase client + generated types + RLS policy SQL
- `packages/config/` — shared tailwind preset, tsconfig base, biome config
- `supabase/migrations/` — timestamped SQL migrations
- `supabase/functions/`  — Edge Functions
- `docs/`            — all documentation (this folder + parents)

## Visual & motion conventions (see `docs/DESIGN_SYSTEM.md` for the long form)

- **Spacing**: 4px grid. Touch targets ≥ 44px.
- **Radii**: 12px (cards/buttons/labels), 16px (modals/popovers), 20px (large surfaces).
- **Shadows**: two tokens only — `shadow-sm` (resting), `shadow-md` (drag/modal). No heavy elevation.
- **Typography**: Inter UI; JetBrains Mono in code blocks. Max 3 sizes per screen.
- **Theme**: light + dark + system. CSS variables (OKLCH), not hex.
- **Layout animations**: Framer Motion `layout` + stable `layoutId` for any reorderable element.
- **Icons**: Lucide only, stroke width 1.5 everywhere, sizes 16/20/24.

## Output expectations (every agent)

- TypeScript strict; **no `any`** (use `unknown` + narrow). Use generated Supabase types from `packages/db/src/types.ts`.
- Tailwind for styles. No CSS files except `globals.css`. No inline `style={{}}` except for Framer Motion variables.
- Functional components + hooks. No class components.
- Server Components by default; `'use client'` only when state, refs, or browser APIs are needed.
- Tests: Vitest + Testing Library for components, Playwright for flows.
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/).

## Common pitfalls in this repo (do not do these)

- ❌ Don't use `react-dnd` — we use **dnd-kit** (touch-friendly).
- ❌ Don't write CSS files — Tailwind v4 only.
- ❌ Don't import service-role Supabase clients from anywhere under `apps/web/app/(client)/**`.
- ❌ Don't reorder by renumbering — use `positionBetween()` from `packages/core/ordering.ts`.
- ❌ Don't use hex literals in JSX. Reference tokens.
- ❌ Don't use eased tweens for interactive motion. Springs only.
- ❌ Don't render light-mode-only or dark-mode-only screens. Both, always.
- ❌ Don't add new dependencies without explicit approval.

## When in doubt

- Read `docs/DESIGN_SYSTEM.md` before any UI work.
- Read `docs/DATA_MODEL.md` before any schema / query work.
- Read `docs/SECURITY.md` before any auth / RLS / upload work.
- Read `docs/ROADMAP.md` to confirm the task is in current scope.
- If the task is ambiguous, **list questions at the top of your reply** instead of guessing.
