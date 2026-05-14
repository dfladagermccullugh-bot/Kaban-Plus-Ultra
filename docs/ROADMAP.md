# Roadmap

Phases are sequential. Each ends with a working, demoable build. Tick boxes as
items land. Update at the end of every session.

**Current phase:** Phase 7 is feature-complete; Phase 8 (store submission) is human-driven and starts after a real-host dry run. Hosted Supabase (ref `xqdhpxfgrckjzzbenivp`) is live with all 6 migrations applied; `apps/web/.env.local` is regenerated from the MCP connector at session start. The bundled self-host path now ships: `docker/supabase/PIN` pins `supabase/supabase` at `v1.24.09`, `docker/kaban-stack.yml` merges kaban-web + caddy + upstream Supabase via `include:`, `docker/bootstrap.sh` applies `supabase/migrations/*.sql` once Postgres is healthy, `scripts/install-kaban.sh` is the `curl ... | sh` installer (DNS pre-flight + containerised JWT signing + first-boot migrations), and the `/setup?t=…` first-run wizard claims the workspace owner without SMTP. Phase 7 polish landed this session: `Dockerfile.web` is buildx-ready (`--platform=$TARGETPLATFORM` on every stage) with `scripts/build-multiarch.sh` driving `linux/amd64,linux/arm64`; a healthchecked `db-backup` side-car streams gzipped `pg_dumpall` into `docker/backups/` on a configurable schedule with retention rotation. Still outstanding for v1: end-to-end fresh-VPS dry run of `install-kaban.sh` (blocked on a Docker host outside this harness), native iOS/Android Xcode/Studio projects (deferred to a dev machine), TestFlight + Play internal builds (Phase 8 / blocked on the human), Lighthouse a11y ≥ 95 / perf ≥ 90 live verification (no browser in the harness), end-to-end smoke against the connected Supabase (no browser + SMTP).

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
- [x] Drag-to-dismiss the mobile bottom sheet — `useDragControls` started from the sticky handle row (so body scroll doesn't trigger drag); closes on `offset.y > 120` or `velocity.y > 500`. Reduced-motion users keep tap-to-close
- [ ] Lighthouse a11y ≥ 95 / perf ≥ 90 live verification (needs a running dev server with seeded Supabase; defer to a session that can boot the stack)

## Phase 7 — Self-host bundle

Goal: one command spins up a private instance.

- [x] `docker/docker-compose.yml` with kaban-web + caddy (supabase: hosted by default; upstream `supabase/supabase` compose layered in for full self-host — see `docs/SELF_HOSTING.md`)
- [x] `docker/Dockerfile.web` — multi-stage Next.js `output: 'standalone'` build
- [x] `docker/Caddyfile` — auto-HTTPS reverse proxy
- [x] `.env.example` for self-host
- [x] `docs/SELF_HOSTING.md` — kickoff walkthrough (hosted Supabase + self-hosted Supabase paths)
- [ ] End-to-end fresh-VPS dry run (needs a Docker host outside the harness)
- [x] Single `kaban-stack.yml` that bundles upstream Supabase pinned to a known-good tag (`docker/supabase/PIN` at `v1.24.09`; `docker/supabase/fetch.sh` unpacks it; `docker/kaban-stack.yml` merges via `include:`)
- [x] One-liner installer (`curl ... | sh`) with DNS pre-flight + first-boot migrations (`scripts/install-kaban.sh` + `docker/bootstrap.sh`)
- [x] First-run wizard for the initial admin account (`/setup` gated by `SETUP_TOKEN`; installer generates the token + prints the URL)
- [x] ARM64 multi-arch image (`docker/Dockerfile.web` with `--platform=$TARGETPLATFORM` on every stage; `scripts/build-multiarch.sh` wraps buildx for `linux/amd64,linux/arm64`)
- [x] Healthchecked Postgres backup side-car (`db-backup` service in `kaban-stack.yml`; gzipped `pg_dumpall` to `docker/backups/`; freshness healthcheck; `BACKUP_INTERVAL_SECONDS` + `BACKUP_RETENTION_DAYS` envs)

## Phase 8 — Store submission (human-driven)

Goal: publish.

Phase 8 is gated almost entirely on assets and accounts only a human
can provide; no agent session can land these end-to-end. Blockers
flagged for the operator:

- **Apple Developer Program account** ($99 / yr, ~24h identity check)
  — required for TestFlight + App Store.
- **Google Play Console account** ($25 one-time) — required for the
  internal-testing track.
- **Xcode + Android Studio installs on a dev machine** — `apps/mobile/`
  is wired (Capacitor config + camera + haptics) but `npx cap add ios`
  and `npx cap add android` still need to be run somewhere with the
  native toolchains available. The harness has neither.
- **Marketing copy + screenshots** — descriptions, keywords, support
  URL, marketing URL, privacy-policy URL, six hero screenshots per
  device class. None of this can be auto-generated responsibly.
- **Privacy policy** hosted at a stable URL (e.g. `/legal/privacy`).
  Stub exists in `docs/SECURITY.md`; needs a real version reviewed by
  the operator before submission.

What an agent session *can* do once those are in hand: generate the
launch icon + splash set from a single source SVG, fill out the App
Store / Play Console listing JSON exports (`xcrun altool` /
`gradle bundleRelease` plumbing), run the build pipelines for
TestFlight + Play Internal, and write the v1.0 release notes.

Phase 8 prep landed this session (agent-tractable pieces only):

- [x] Source SVG launch assets under `apps/mobile/assets/`
  (`icon-only.svg`, `icon-foreground.svg`, `icon-background.svg`,
  `splash.svg`, `splash-dark.svg`) + `pnpm --filter @kpu/mobile
  generate:assets` script (wraps `npx --yes @capacitor/assets@3`).
  Pending `npx cap add ios|android` on a dev machine before
  per-platform bundles can be written.
- [x] `scripts/release-ios.sh` — staged TestFlight plumbing
  (`xcodebuild archive` → `-exportArchive` → `xcrun altool
  --upload-app`). `bash -n` clean; refuses to run without
  `apps/mobile/ios/` + `APPLE_ID` + `APP_SPECIFIC_PASSWORD` + `TEAM_ID`.
- [x] `scripts/release-android.sh` — staged Play Internal plumbing
  (`./gradlew bundleRelease` + optional `fastlane supply`). `bash -n`
  clean; refuses to run without `apps/mobile/android/` + keystore env.
- [x] `docs/RELEASE_NOTES_1.0.md` — v1.0 release notes draft, with a
  pre-tag checklist for the human (privacy URL, screenshots, signed
  builds, install smoke-test, Lighthouse pass).
- [x] `/legal/privacy` page — real Next.js route stubbed from
  `docs/SECURITY.md`, footer-linked from `/`, flagged in-page as
  pending legal review.

Still blocked on the human:

- [ ] App Store listing (screenshots, description, privacy policy) — blocked on assets + privacy URL
- [ ] App Store review pass — blocked on TestFlight build + Apple Dev account
- [ ] Play Store listing — blocked on assets + privacy URL
- [ ] Play Store review pass — blocked on Play Internal build + Play Console account

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
