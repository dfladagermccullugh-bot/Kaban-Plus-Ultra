# Roadmap

Phases are sequential. Each ends with a working, demoable build. Tick boxes as
items land. Update at the end of every session.

**Current phase:** Phase 6 underway. Markdown `.zip` round-trip is now complete: export (`/b/[id]/export` + header button) and drag-drop import (`<ZipDropzone>` on `/boards` creates a new board; on `/b/[id]` merges into the existing one). Animation polish is in: subtle Framer Motion spring page transitions on the `(app)` segment, and the card editor modal is now a bottom-sheet on `(pointer: coarse)` (touch) and a centered dialog elsewhere — both honor `prefers-reduced-motion`. Axe-core is wired into the Vitest CI pass (a11y gate; 3 component tests). Perf: dynamic-importing the Tiptap stack drops `/b/[id]/c/[cardId]` from 263 → 161 kB First Load JS, and deferring the Supabase browser client at sign-in drops `/sign-in` from 153 → 116 kB. Still outstanding for v1: native iOS/Android Xcode/Studio projects (deferred to a dev machine), TestFlight + Play internal builds, Lighthouse a11y ≥ 95 / perf ≥ 90 live verification.

---

## Phase 0 — Scaffolding ✦ complete (merged to main)

Goal: a green CI baseline + every doc in place so any future session has full context.

- [x] Repo structure decided
- [x] All documentation files created (`CLAUDE.md`, `docs/*.md`, `docs/AGENTS/*`, ADR 0001)
- [x] Monorepo bootstrap: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `biome.json`, `tsconfig.base.json`
- [x] `apps/web/` Next.js 15 scaffold with theme tokens + dark mode toggle
- [x] `packages/ui/`, `packages/core/`, `packages/db/`, `packages/config/` skeletons (with `Button`, `cn`, ordering helpers + tests, Supabase client stubs)
- [x] `.env.example` committed; `supabase/config.toml` for local CLI use
- [x] First migration: `supabase/migrations/0001_init.sql` (all tables + RLS + auth trigger + demo board seed)
- [x] Vitest skeleton green (13 tests in `@kpu/core`)
- [x] GitHub Actions workflow: typecheck + test + lint + build on push
- [x] Local green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — all pass; dev server boots and serves the landing page
- [x] Merged to `main` (PR #2)

## Phase 1 — Auth + Profile ✦ complete, merged to main (avatar deferred to phase 3)

Goal: sign in, sign out, edit profile.

- [x] Email magic link sign-in (`/sign-in` form → Supabase `signInWithOtp`)
- [x] Google OAuth sign-in (`signInWithOAuth({ provider: 'google' })`)
- [x] `on_auth_user_created` trigger seeds profile + demo board (in `supabase/migrations/0001_init.sql`)
- [x] Protected route middleware (`apps/web/middleware.ts` + `lib/supabase/middleware.ts`)
- [x] `/profile` page (display name + accent color, server action)
- [x] Sign-out flow (`/sign-out` POST handler) + session persistence (HTTP-only cookies via `@supabase/ssr`)
- [ ] Avatar upload (deferred to Phase 3 when Supabase Storage buckets are created)

## Phase 2 — Board CRUD + 2D grid

Goal: the headline feature. Real swimlanes with drag-drop.

- [x] Boards list page (`/boards`)
- [x] Create / rename / delete board
- [x] Board view (`/b/[id]`) with sticky row + column headers
- [x] Rows: create, rename, recolor, reorder, collapse, delete
- [x] Columns: create, rename, recolor, reorder, set WIP limit (+ over-limit badge), delete
- [x] Cards: quick create, drag-drop across cells (dnd-kit + fractional indexing), inline rename, delete
- [x] Optimistic mutations via TanStack Query (card moves) + `useTransition` (CRUD)
- [x] Virtualization for cells > 50 cards (`@tanstack/react-virtual`; per-cell, threshold-gated so dnd-kit keeps precise drops on small cells)
- [x] Ctrl/⌘-scroll zoom (zoom level persisted per board in `localStorage`); pinch deferred until Capacitor (Phase 5)

## Phase 3 — Card editor + images + labels

Goal: cards are real, expressive, with images.

- [x] Tiptap markdown editor in modal (parallel route `/b/[id]/c/[cardId]` with intercept)
- [x] Auto-save (600 ms debounce) with "saved" pulse
- [x] Image paste / drag-drop → Supabase Storage (`card-images` bucket, migration 0003) → blurhash placeholder (client-side `blurhash` encode)
- [x] Cover image on card front (with chooser in the modal)
- [x] Labels: create + color picker + multi-select on cards; rename / recolor / delete UI now lives in the board settings popover
- [x] Label filter bar at the top of the board (AND-of-labels)

## Phase 4 — Realtime + sharing

Goal: friends on the same board, live.

- [x] Realtime subscription per board (cards, rows, columns, labels, card_labels, images) — migration 0004 enables the publication; `useBoardRealtime` merges incoming changes into BoardView state and locks the actively-dragged card against remote echoes
- [x] Presence avatars in top-right (`presence:<boardId>` channel — initials + accent ring; self gets a thinner ring)
- [x] "X is editing" hint on cards open in another client (presence payload carries `viewing_card_id`; `PeerEditingBanner` surfaces it inside the card modal)
- [x] Invite collaborator by email (sends magic link with attached invite; service-role invite path + auto-upsert into `board_collaborators`)
- [x] Role management (viewer / editor / admin) — popover surface in board settings
- [x] Public read-only share links (generate, rotate, revoke — migration 0005, RPC + RLS for child tables, `/s/[id]` viewer route)
- [x] Audit-events writer — invite / role-update / collaborator-remove / share-token rotate / revoke server actions all insert into `audit_events` via the service-role client (`apps/web/lib/audit.ts`)
- [x] Invite directory lookup — `profiles.email` pinned by the signup trigger (migration 0006) replaces single-page `listUsers` paging

## Phase 5 — Mobile shell

Goal: real native apps on iPhone and Android.

- [x] `apps/mobile/` Capacitor init, `capacitor.config.ts` (workspace package; iOS/Android projects to be added on a dev machine via `npx cap add`)
- [ ] iOS Xcode project + splash + icon set
- [ ] Android Studio project + adaptive icon set
- [x] Touch-tuned drag with haptic on pickup/drop (`@capacitor/haptics`; respects `prefers-reduced-motion`)
- [x] Pull-to-refresh on boards list (touch-only, threshold 72px → `router.refresh()`)
- [x] Camera plugin for card image capture (`@capacitor/camera`; web fallback uses a hidden `<input type="file" accept="image/*" capture="environment">`; both feed `uploadCardImage`)
- [ ] TestFlight build (internal testers)
- [ ] Play Console Internal Testing build

## Phase 6 — Markdown export/import + polish

Goal: own your data; final polish pass.

- [x] Board → `.zip` of `.md` files (one folder per row, one file per card; YAML frontmatter for title/id/row/column/labels/cover; README matrix; jszip + `/b/[id]/export` route handler + `<ExportButton>` in the header)
- [x] Drag-drop import (`.zip`) — `/boards` creates a new board; `/b/[id]` merges into the existing board (rows / columns / labels matched by case-insensitive title, missing ones appended; cards always appended). Pure parser in `@kpu/core`; server actions per page; shared `<ZipDropzone>` overlay
- [x] Animation polish: page transitions on `(app)` segment (Framer Motion spring) + card-editor modal becomes a bottom-sheet on `(pointer: coarse)`; centered dialog on fine pointer. Exit animation runs before route push via `AnimatePresence`
- [x] `prefers-reduced-motion` QA pass — page transition and modal both collapse to a 0-duration cross-fade when reduced motion is requested (`useReducedMotion`)
- [x] axe-core in CI — `apps/web/tests/a11y.test.tsx` mounts `Button`/`Input`/`Label`, `ThemeToggle`, and `SignInForm` in jsdom and asserts zero violations; runs as part of `pnpm test`
- [ ] Lighthouse a11y ≥ 95 / perf ≥ 90 live verification (needs a running dev server with seeded Supabase; defer to a session that can boot the stack)

## Phase 7 — Self-host bundle

Goal: one command spins up a private instance.

- [ ] `docker/docker-compose.yml` with supabase + kaban-web + caddy
- [ ] `.env.example` for self-host
- [ ] `docs/SELF_HOSTING.md` walkthrough completed end-to-end on a fresh VPS
- [ ] First-run wizard for the initial admin account

## Phase 8 — Store submission (human-driven)

Goal: publish.

- [ ] App Store listing (screenshots, description, privacy policy)
- [ ] App Store review pass
- [ ] Play Store listing
- [ ] Play Store review pass

---

## v2 candidates (out of scope until v1 ships)

- Due dates + checklists + comments + mentions
- Activity feed UI
- Yjs CRDT for offline + true collaborative editing of card bodies
- Teams / workspaces / billing
- Calendar / timeline / Gantt views
- Live two-way markdown filesystem sync
- AI: card summarization, auto-labeling, "what should I work on next?"
- Plugins / extensions
