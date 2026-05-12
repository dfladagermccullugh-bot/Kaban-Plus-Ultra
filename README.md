# Kaban Plus Ultra

> Trello at home, with real swimlanes.

A Kanban board app where every board is a true **2D grid** (rows × columns),
cards are markdown with inline images, and sharing is friction-free. One
TypeScript codebase ships to **web (desktop + mobile), iOS, and Android**.

**Status:** Phase 0 — scaffolding. See [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Why this exists

Two friends got tired of Trello: chaotic visual hierarchy, no real swimlanes,
aggressive upsells, no good "self-host it and chill" option. KPU is the version
they wanted. See [`docs/VISION.md`](./docs/VISION.md) for the full origin
story.

## What it is (v1)

- **2D swimlane grid** — every board is rows × columns. Cards live in (row, column) cells.
- **Markdown cards** with inline + cover image support.
- **Per-board sharing** — invite friends by email, or generate a read-only link.
- **Real-time collab** — see your friends' moves live.
- **Cloud-first or self-hostable** — same code, your choice.
- **Apple/Google design discipline** — restraint, springs, dark mode, a11y, no upsell modals ever.

## Documentation

All docs are markdown. AI sessions and humans both start here.

| File | What |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Entry point for any Claude session |
| [`docs/VISION.md`](./docs/VISION.md) | Why this exists, what we won't build |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | 8 phases with checkboxes |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, repo layout, data flow |
| [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Tokens, motion, components |
| [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) | Schema, RLS, fractional indexing |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | RLS invariants, secrets, threat model |
| [`docs/SESSION_PROTOCOL.md`](./docs/SESSION_PROTOCOL.md) | Start/end checklists for every session |
| [`docs/SESSION_LOG.md`](./docs/SESSION_LOG.md) | Append-only handoff log |
| [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md) | `docker compose up` instructions |
| [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) | Local setup, scripts, conventions |
| [`docs/DECISIONS/`](./docs/DECISIONS/) | Architecture Decision Records (ADRs) |
| [`docs/AGENTS/`](./docs/AGENTS/) | Primer docs for delegating to Codex or Gemini |

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Framer Motion ·
dnd-kit · TanStack Query · Zustand · Tiptap · Supabase (Postgres + Auth +
Realtime + Storage) · Capacitor 6 · pnpm + Turborepo · Biome · Vitest ·
Playwright.

## License

Apache-2.0. See [LICENSE](./LICENSE).
