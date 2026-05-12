# @kpu/web

The Kaban Plus Ultra web app. Next.js 15 (App Router) + React 19 + Tailwind v4.

## Dev

```bash
pnpm install                  # at repo root
pnpm --filter @kpu/web dev    # http://localhost:3000
```

## Structure

- `app/` — App Router routes
- `components/` — app-local React components
- `lib/` — app-local utilities (Supabase client wiring, etc.)

Shared UI primitives live in [`packages/ui`](../../packages/ui).
Domain logic in [`packages/core`](../../packages/core).
Database client + types in [`packages/db`](../../packages/db).

## Design tokens

CSS variables live in `app/globals.css` (`@theme`). See
[`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md) for the canonical spec.
