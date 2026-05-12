# Roadmap

Phases are sequential. Each ends with a working, demoable build. Tick boxes as
items land. Update at the end of every session.

**Current phase:** Phase 0 (Scaffolding) — **complete locally**, awaiting CI confirmation. Phase 1 (Auth + Profile) is next.

---

## Phase 0 — Scaffolding ✦ complete (pending CI)

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
- [ ] CI green on `claude/chat-analysis-app-2fsuX` (verify after push)

## Phase 1 — Auth + Profile

Goal: sign in, sign out, edit profile.

- [ ] Email magic link sign-in
- [ ] Google OAuth sign-in
- [ ] `on_auth_user_created` trigger seeds profile + demo board
- [ ] Protected route middleware
- [ ] `/profile` page (display name, avatar upload, accent color)
- [ ] Sign-out flow + session persistence

## Phase 2 — Board CRUD + 2D grid

Goal: the headline feature. Real swimlanes with drag-drop.

- [ ] Boards list page (`/boards`)
- [ ] Create / rename / delete board
- [ ] Board view (`/b/[id]`) with sticky row + column headers
- [ ] Rows: create, rename, recolor, reorder, collapse, delete
- [ ] Columns: create, rename, recolor, reorder, set WIP limit, delete
- [ ] Cards: create (quick + full), drag-drop across cells (dnd-kit + fractional indexing)
- [ ] Optimistic mutations via TanStack Query
- [ ] Virtualization for boards > 200 cards (`@tanstack/react-virtual`)
- [ ] Pinch / ctrl-scroll zoom (zoom level persisted per board)

## Phase 3 — Card editor + images + labels

Goal: cards are real, expressive, with images.

- [ ] Tiptap markdown editor in modal
- [ ] Auto-save (600ms debounce) with "saved" pulse
- [ ] Image paste / drag-drop → Supabase Storage → blurhash placeholder
- [ ] Cover image on card front
- [ ] Labels: CRUD, color picker, multi-select on cards
- [ ] Label filter bar at the top of the board

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
