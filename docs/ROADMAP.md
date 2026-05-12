# Roadmap

Phases are sequential. Each ends with a working, demoable build. Tick boxes as
items land. Update at the end of every session.

**Current phase:** Phase 3 in progress — editor + images + labels landed on the working branch (commit pending). Virtualization (Phase 2 carry-over) and label-delete UX (no inline label-management page yet) are the remaining unticked items.

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
- [ ] Virtualization for boards > 200 cards (`@tanstack/react-virtual`)
- [x] Ctrl/⌘-scroll zoom (zoom level persisted per board in `localStorage`); pinch deferred until Capacitor (Phase 5)

## Phase 3 — Card editor + images + labels

Goal: cards are real, expressive, with images.

- [x] Tiptap markdown editor in modal (parallel route `/b/[id]/c/[cardId]` with intercept)
- [x] Auto-save (600 ms debounce) with "saved" pulse
- [x] Image paste / drag-drop → Supabase Storage (`card-images` bucket, migration 0003) → blurhash placeholder (client-side `blurhash` encode)
- [x] Cover image on card front (with chooser in the modal)
- [x] Labels: create + color picker + multi-select on cards (delete + rename actions exist server-side; UI lands in a follow-up if needed)
- [x] Label filter bar at the top of the board (AND-of-labels)

## Phase 4 — Realtime + sharing

Goal: friends on the same board, live.

- [ ] Realtime subscription per board (cards, rows, columns, labels)
- [ ] Presence avatars in top-right
- [ ] "X is editing" hint on cards open in another client
- [ ] Invite collaborator by email (sends magic link with attached invite)
- [ ] Role management (viewer / editor / admin)
- [ ] Public read-only share links (generate, rotate, revoke)

## Phase 5 — Mobile shell

Goal: real native apps on iPhone and Android.

- [ ] `apps/mobile/` Capacitor init, `capacitor.config.ts`
- [ ] iOS Xcode project + splash + icon set
- [ ] Android Studio project + adaptive icon set
- [ ] Touch-tuned drag with haptic on pickup/drop (`@capacitor/haptics`)
- [ ] Pull-to-refresh on boards list
- [ ] Camera plugin for card image capture
- [ ] TestFlight build (internal testers)
- [ ] Play Console Internal Testing build

## Phase 6 — Markdown export/import + polish

Goal: own your data; final polish pass.

- [ ] Board → `.zip` of `.md` files (one folder per row, one file per card)
- [ ] Drag-drop import (`.zip` or folder of `.md`)
- [ ] Animation polish: page transitions, modal sheets on mobile
- [ ] `prefers-reduced-motion` QA pass
- [ ] a11y audit (axe-core in CI; Lighthouse a11y ≥ 95)
- [ ] Lighthouse perf ≥ 90 on web

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
