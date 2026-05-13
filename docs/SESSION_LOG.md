# Session Log

Append-only. Newest entries on top. Use the template in `SESSION_PROTOCOL.md`.

---

## 2026-05-13 — Phase 7 main: pinned Supabase upstream + merged stack + `curl|sh` installer

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kanban-plus-ultra-dev-sG11L` (session-assigned;
  stacks on `main` at `6f01fb8` — merge of PR #19 from the previous
  session's Phase 7 kickoff branch)
- **Phase**: 7 (main work — closes ADR 0013's "follow-ups")

### Goal

Land the Phase 7 main bundle: pin upstream Supabase at a known-good
tag, merge it with our kaban-web + caddy compose, ship a first-boot
migrations runner, and build the `curl ... | sh` installer the README
will eventually advertise. Smoke-tests against the connected Supabase
and the Lighthouse pass stay deferred (still no browser in the
harness).

### Changed

**`.env.local` regeneration** (`apps/web/.env.local` — local-only,
gitignored)
- Rewritten from the MCP connector at session start: URL + legacy anon
  JWT for project ref `xqdhpxfgrckjzzbenivp`. Carries forward the TODO
  on `SUPABASE_SERVICE_ROLE_KEY` — MCP doesn't expose service-role.

**Pinned upstream Supabase**
(`docker/supabase/PIN`, `docker/supabase/fetch.sh`,
`docker/supabase/.gitignore`, `docker/supabase/README.md`)
- `PIN` is one line: `v1.24.09` — the last upstream self-host tag with
  fully date-pinned service images.
- `fetch.sh` `curl | tar`s `supabase/supabase@$PIN docker/` from the
  GitHub source tarball into `docker/supabase/upstream/docker/`. Marker
  file `.fetched-ref` short-circuits re-runs. Verified end-to-end
  against the real tarball this session.
- The `upstream/` directory is gitignored so we don't fork the upstream
  tree.

**Merged stack** (`docker/kaban-stack.yml`)
- Uses Compose v2.20+ `include:` to layer the upstream Supabase compose
  on top of our `docker-compose.yml`. Bind mounts inside upstream's
  compose (`./volumes/...`) still resolve correctly because `include:`
  evaluates relative paths against the included file's own directory.
- A tiny `services.web` override block adds `depends_on: kong
  (condition: service_healthy)` and rewires
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` to the upstream-managed secrets
  (`ANON_KEY`, `SERVICE_ROLE_KEY`).

**First-boot migrations** (`docker/bootstrap.sh`)
- Polls `docker compose ps` for the `db` service's `Health` column;
  retries up to 60 × 2 s before giving up.
- Once healthy, `psql -v ON_ERROR_STOP=1`s every file in
  `supabase/migrations/` in order. Each migration is already idempotent
  (`if not exists` / `or replace`), so re-application under `--force`
  is safe.
- `.bootstrap-done` marker prevents accidental re-runs.

**`curl | sh` installer** (`scripts/install-kaban.sh`)
- Nine-step flow: prereq check → checkout (clone or `git pull`) → DNS
  pre-flight (`getent`/`dig` vs `ifconfig.me`/`ipify`, skipped for
  `localhost`) → `.env` generation with fresh random
  `POSTGRES_PASSWORD` / `JWT_SECRET` / `DASHBOARD_PASSWORD` and JWTs
  signed against that secret inside a throwaway `python:3.12-alpine`
  container → `supabase/fetch.sh` → `docker compose pull` →
  `docker compose up -d --build` → `bootstrap.sh` → final URL banner.
- Re-runnable on the same host as the upgrade path: existing
  `docker/.env` is preserved, fetch is a no-op on PIN match, and
  bootstrap is gated by its marker.
- Compose v2.20+ check is a soft warning — older Compose silently
  ignores `include:` and would start only kaban-web + caddy.

**Expanded env example** (`docker/.env.example`)
- Now includes every variable the upstream Supabase compose reads:
  `POSTGRES_*`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET`,
  `DASHBOARD_*`, `KONG_*`, GoTrue / SMTP / Studio / Functions /
  Analytics. The installer writes `docker/.env` from this template; the
  file documents every knob for the by-hand path.

**Docs**
- `docs/SELF_HOSTING.md` — TL;DR now leads with the `curl | sh`
  one-liner; "Path B" rewritten to use the merged stack;
  Phase-7-follow-ups list trimmed.
- `docs/ROADMAP.md` — current-phase paragraph rewritten; Phase 7
  `kaban-stack.yml` + `curl | sh installer` boxes ticked; remaining
  follow-ups (fresh-VPS dry run, first-run wizard) left open.
- `docs/DECISIONS/0015-self-host-one-liner.md` — new (pinning strategy,
  `include:`-based merge, containerised JWT signing, alternatives).

### Verified

- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (105 files, biome clean)
- `pnpm typecheck` ✅ (5 packages, FULL TURBO on the second run)
- `pnpm test` ✅ — 29 tests pass (26 `@kpu/core` + 3 `@kpu/web` a11y)
- `pnpm build` ✅ — bundles preserved (`/b/[id]/c/[cardId]` 161 kB,
  `/sign-in` 116 kB, `/b/[id]` 197 kB; baseline was 196 — within 1 kB
  of the budget)
- Supabase MCP — `list_migrations` 6/6, `list_tables` 10/10 with RLS
  enabled on each.
- `bash -n` clean on `fetch.sh`, `bootstrap.sh`, `install-kaban.sh`.
- `fetch.sh` exercised end-to-end against the GitHub tarball in a
  scratch dir — unpacks `docker-compose.yml`, `volumes/`, etc., and
  writes the `.fetched-ref` marker correctly.

### Decisions taken this session

- ADR 0015 — pin upstream Supabase as `PIN` + `fetch.sh` (not a
  submodule, not vendored); merge via Compose `include:`; sign JWTs
  inside a throwaway `python:3.12-alpine` container so the installer
  has zero extra language deps.

### Delegations

None.

### Next up

1. **End-to-end fresh-VPS dry run** of `install-kaban.sh` against a
   real Docker host — still blocked on environment.
2. **End-to-end smoke against the connected Supabase** (magic-link
   sign-in via the Supabase auth admin API; needs
   `SUPABASE_SERVICE_ROLE_KEY` from the operator).
3. **Lighthouse a11y ≥ 95 / perf ≥ 90 live verification** — same
   blocker as #2.
4. **First-run admin wizard** for the bundled stack (Phase 7 final
   follow-up).

### Blockers / open questions

- **`SUPABASE_SERVICE_ROLE_KEY`** — still not in `.env.local`. The MCP
  only exposes publishable keys; operator must drop it in for invite,
  audit-events, and the auth admin API.
- **SMTP / Google OAuth** — still unprovided.
- **Docker daemon** — none in this harness, so the merged compose, the
  installer, and `bootstrap.sh` are bash-syntax + tarball-fetch
  verified but not exercised end-to-end. A fresh-VPS pass is the next
  Phase-7 checkbox.
- **Native iOS/Android** — still deferred to a dev machine.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.

---

## 2026-05-13 — Supabase MCP wire-up, sheet drag-dismiss, Phase 7 self-host kickoff

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/verify-supabase-connector-N1ufJ` (session-assigned;
  stacks on `main` at `6184046` — merge of PR #18 from the previous
  session's Phase 6b/c/d branch)
- **Phase**: 6 closeout + 7 kickoff

### Goal

Three things, in order: (1) confirm the freshly-connected Supabase MCP,
write `.env.local`, and apply migrations `0001` → `0006` against the
linked project; (2) close the ADR-0011 follow-up by adding
drag-to-dismiss to the mobile bottom sheet; (3) kick off Phase 7 with a
docker compose + Caddy bundle + walkthrough doc.

### Changed

**Supabase wire-up** (`apps/web/.env.local` — new; gitignored)
- Bound to the `Kaban Plus Ultra` MCP project (ref
  `xqdhpxfgrckjzzbenivp`, region `us-west-2`, status
  `ACTIVE_HEALTHY`).
- `NEXT_PUBLIC_SUPABASE_URL=https://xqdhpxfgrckjzzbenivp.supabase.co`,
  legacy anon JWT (matches `@supabase/ssr` 0.5's expectation, not the
  new `sb_publishable_…` token), `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- `SUPABASE_SERVICE_ROLE_KEY` left empty with a TODO — the MCP
  `get_publishable_keys` tool doesn't expose service-role; the operator
  drops it in by hand before exercising invite-by-email / audit-events.
- Migrations applied in order via `mcp__d254b538-…__apply_migration`:
  - `0001_init` — 10 public tables, RLS, helper functions, signup trigger
  - `0002_drop_board_orders` — drops `boards.row_order` / `col_order`
  - `0003_storage_buckets` — `card-images`, `avatars`, `exports`
  - `0004_realtime` — adds `cards / rows / columns / labels /
    card_labels / images` to `supabase_realtime`
  - `0005_share_links` — `has_share_access`, rotate / revoke RPCs
  - `0006_profiles_email` — pin email on `profiles`, sync trigger
- `list_migrations` confirms all six (versions `20260513180358` →
  `20260513180502`). `list_tables` returns the expected 10. Security
  advisor warnings are all pre-existing design (SECURITY DEFINER on
  helpers; `moddatetime` in `public`; `avatars` listing). Not
  regressions — captured in ADR 0012.

**Drag-to-dismiss the bottom sheet**
(`apps/web/app/(app)/b/[id]/card-editor-modal.tsx`)
- `useDragControls()` + `dragListener={false}` on the sheet's
  `<motion.div>`. The handle row's `onPointerDown` is the only thing
  that calls `dragControls.start(e)`, so internal body scroll never
  starts a drag.
- `dragConstraints={{ top: 0, bottom: 0 }}` snaps back; `dragElastic={{
  top: 0, bottom: 0.4 }}` lets the gesture feel natural pulling down.
- Threshold per the session prompt: close on `offset.y > 120` **or**
  `velocity.y > 500`. Both flow through the existing `close()` so
  `AnimatePresence` exit runs before the parallel-route slot unmounts.
- `dragEnabled = isSheet && !reduce` — reduced-motion users keep
  tap-to-close on the X / backdrop.
- Handle row gets `touch-none` so the browser doesn't compete with the
  drag. The sticky X stops propagation on pointer-down so tapping it
  doesn't kick off a drag.

**Phase 7 self-host kickoff**
- `docker/Dockerfile.web` — multi-stage Alpine build (`deps` →
  `build` → `runtime`); copies the `next build --output=standalone`
  trace into a non-root runtime image. Bakes `NEXT_PUBLIC_*` via
  `--build-arg`; `SUPABASE_SERVICE_ROLE_KEY` stays runtime-only.
- `apps/web/next.config.ts` — added `output: 'standalone'` and
  `outputFileTracingRoot = path.join(__dirname, '../..')` so Next's
  tracer walks past `apps/web/` to pick up `@kpu/{core,db,ui}`.
- `docker/docker-compose.yml` — two services (`web` + `caddy`).
  Supabase is **not** inline: hosted by default, with the upstream
  `supabase/supabase` compose layered in via a second `-f` for the
  full self-host path. Health-checked web, ports 80/443 on caddy.
- `docker/Caddyfile` — auto-HTTPS for `{$KABAN_HOST}`, immutable
  cache on `/_next/static/*`, HSTS + nosniff + referrer-policy.
- `docker/.env.example` — every variable the operator needs.
- `docs/SELF_HOSTING.md` — replaced the Phase-7 stub with the
  kickoff walkthrough (hosted Supabase + self-hosted Supabase paths,
  backup story, follow-ups).

**Docs**
- `docs/ROADMAP.md` — current-phase blurb rewritten; Phase 6
  "Drag-to-dismiss" ticked off; Phase 7 first four boxes ticked
  (Dockerfile, compose, Caddyfile, env example, walkthrough).
- `docs/DECISIONS/0012-supabase-mcp-wireup.md` — new
- `docs/DECISIONS/0013-self-host-bundle-kickoff.md` — new
- `docs/DECISIONS/0014-drag-to-dismiss-sheet.md` — new

### Verified

- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (105 files, biome clean)
- `pnpm typecheck` ✅ (5 packages)
- `pnpm test` ✅ — 29 tests pass (26 `@kpu/core` + 3 `@kpu/web` a11y)
- `pnpm build` — not re-run after edits; lint/typecheck cover the
  surface that changed (env reads, modal handlers, next.config). Will
  run as part of the final session-end check.
- Supabase MCP: `list_migrations` 6/6, `list_tables` 10/10,
  `get_advisors` only pre-existing warnings.

### Decisions taken this session

- ADR 0012 — bind to the named `Kaban Plus Ultra` MCP project; apply
  migrations via `apply_migration` (records into Supabase's own table);
  use the legacy anon JWT for `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
  service-role left TODO until the operator provides it.
- ADR 0013 — ship a two-service compose (web + caddy); Supabase via
  hosted-by-default with self-host layered in via a second compose
  file; `output: 'standalone'` with `outputFileTracingRoot` set to the
  repo root.
- ADR 0014 — `useDragControls` + handle-only `dragListener` so body
  scroll never starts a drag; threshold `offset.y > 120` or
  `velocity.y > 500`; reduced-motion users never get drag.

### Delegations

None.

### Next up

1. **End-to-end smoke test against the connected Supabase.** Needs a
   browser to drive magic-link sign-in (or `SUPABASE_SERVICE_ROLE_KEY`
   + the inbucket / admin API to grab the link headlessly). Deferred —
   this harness can't drive a real browser.
2. **Lighthouse a11y ≥ 95 / perf ≥ 90 live verification** — same
   blocker as #1.
3. **Phase 7 main work** — pin the upstream Supabase compose into
   `docker/supabase/`, write `kaban-stack.yml`, build the one-liner
   installer, add the first-run admin wizard.
4. **Native iOS/Android Xcode/Studio projects** — still blocked on a
   dev machine.

### Blockers / open questions

- **`SUPABASE_SERVICE_ROLE_KEY`** — needed for invite-by-email +
  audit-events writer + the storage-policies path that runs as the
  service role. The MCP only exposed publishable keys; operator
  intervention required.
- **SMTP / Google OAuth** — still not provided. Magic-link sign-in
  works locally against inbucket but isn't wired up against the
  connected Supabase project yet.
- **`apps/mobile/` native folders** — still deferred (no Xcode /
  Android Studio in this harness).
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.
- **No Docker daemon in the harness** — the `Dockerfile.web` build
  was not exercised end-to-end this session; the same `next build` is
  covered by CI.

---

## 2026-05-13 — Phase 6b/c/d: page transitions, mobile bottom-sheet, axe-core, Tiptap dynamic import

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/markdown-zip-import-7c2Oc` (session-assigned;
  stacks on `main` at `82bcdb0` — PR #17 merged the previous session's
  Phase 6a Markdown ZIP import work)
- **Phase**: 6 (Markdown export/import + polish)

### Goal
Land the Phase 6b/c/d polish triad: subtle Framer Motion page
transitions on the `(app)` segment, a bottom-sheet card editor on
touch devices (centered dialog elsewhere) — both honouring
`prefers-reduced-motion` — wire axe-core into Vitest as an a11y CI
gate, and dynamic-import Tiptap (and the Supabase browser client on
sign-in) so the heaviest routes drop below the perf budget.

### Changed

**Page transitions** (`apps/web/components/page-transition.tsx` — new;
`apps/web/app/(app)/layout.tsx` — new)
- Client wrapper: `<AnimatePresence mode="wait" initial={false}>` keyed
  on `usePathname()`. Animates `opacity` + a tiny `y` (4 → 0 in,
  0 → −2 out) via the golden-rule spring
  `{ type: 'spring', stiffness: 300, damping: 30 }`.
  Reduced-motion collapses to `duration: 0`.
- Lives in a new `(app)/layout.tsx` so `/boards`, `/b/[id]`, `/profile`
  all inherit the transition without re-mounting board state.

**Card editor modal** (`apps/web/app/(app)/b/[id]/card-editor-modal.tsx`)
- Replaced the CSS-only fade-in wrapper with
  `<AnimatePresence onExitComplete={() => router.push('/b/${id}')}>` so
  the **exit animation actually plays** before the parallel route slot
  unmounts. Internal `open` state flips to `false` on close, the exit
  variant runs, then we route back.
- On `(pointer: coarse)` (touch): bottom sheet
  (`fixed inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl`) sliding up
  from `y: 100%` with a sticky drag-handle row that hosts the close X
  so it stays visible when the sheet content scrolls.
- On fine pointer: centered dialog (`rounded-lg max-w-3xl`) with the
  heavy-surface spring (`stiffness: 220, damping: 28`) animating
  `{ opacity, y, scale }`.
- `useReducedMotion()` collapses both variants to a 0-duration opacity
  swap.
- `apps/web/lib/use-media-query.ts` — new tiny hook
  (`useMediaQuery(query)` + `useCoarsePointer()`).

**Tiptap dynamic import** (perf — `card-editor-modal.tsx`)
- `TiptapEditor` now loaded via
  `next/dynamic(() => import('./tiptap-editor'), { ssr: false })`.
- `/b/[id]/(.)c/[cardId]` and `/b/[id]/c/[cardId]` First Load JS
  dropped from **263 kB → 161 kB** (≈ −39 %).

**Sign-in Supabase client deferral** (`apps/web/app/sign-in/sign-in-form.tsx`)
- Moved `createClient` from the top-level import to a `getSupabase()`
  helper that `await import('@/lib/supabase/browser')` inside event
  handlers. `/sign-in` First Load JS dropped from
  **153 kB → 116 kB**.

**Axe-core CI gate** (`apps/web/vitest.config.ts` — new;
`apps/web/tests/a11y.test.tsx` — new)
- Vitest config with `environment: 'jsdom'`, `@` path alias, and a
  test glob limited to `tests/**`.
- 3 a11y tests: (1) `Button` + `Input` + `Label` compose a valid
  labelled form field, (2) `<ThemeToggle>` is a labelled radio group,
  (3) `<SignInForm>` idle state has accessible inputs + buttons. All
  three assert `axe.run(...)` returns zero violations.
- The `color-contrast` rule is disabled in jsdom (it needs computed
  styles which jsdom doesn't compute). Lighthouse picks that up on
  the live site.

**Deps**
- `apps/web` gains `framer-motion ^12.38.0`, plus dev deps `axe-core`,
  `jsdom`, `@testing-library/react`, `@testing-library/dom`.

### Verified

- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (104 files, biome clean)
- `pnpm typecheck` ✅ (5 packages)
- `pnpm test` ✅ — **29 tests pass** (26 in `@kpu/core` + 3 new axe
  tests in `@kpu/web`)
- `pnpm build` ✅

| Route | Before | After | Δ |
| --- | --- | --- | --- |
| `/b/[id]/(.)c/[cardId]` | 263 kB | **161 kB** | −102 kB |
| `/b/[id]/c/[cardId]` | 263 kB | **161 kB** | −102 kB |
| `/sign-in` | 153 kB | **116 kB** | −37 kB |
| `/b/[id]` | 196 kB | 197 kB | +1 kB (framer-motion) |
| `/boards` | 124 kB | 124 kB | unchanged |
| `/` | 116 kB | 116 kB | unchanged |
| Shared First Load | 102 kB | 102 kB | unchanged |

### ADRs added
- `docs/DECISIONS/0011-page-transitions-and-modal-sheets.md`

### Delegations
None.

### Decisions taken this session (noted in ADR 0011)
- **`AnimatePresence onExitComplete` + internal `open` state** to make
  the modal exit animation play before the parallel-route slot
  unmounts.
- **One component, two variants** (dialog + sheet) rather than two
  separate components — shared ~95 % of state and effects.
- **`color-contrast` disabled in jsdom axe runs** — Lighthouse owns
  that rule live; jsdom has no computed styles.
- **Dynamic-import Tiptap, not React.lazy** — `next/dynamic` gives us
  a `loading` placeholder slot without a top-level `<Suspense>`.

### Next up
1. **Lighthouse a11y ≥ 95 / perf ≥ 90 live verification.** Needs a
   running dev server with a seeded Supabase. Defer to a session that
   can boot `supabase start` + `pnpm dev` end-to-end and run
   `lhci`/`lighthouse` from CLI.
2. **Drag-to-dismiss the bottom sheet.** Framer Motion `drag="y"` +
   `onDragEnd` threshold. Polish, not required for v1.
3. **Native projects** (still deferred): `cd apps/mobile && npx cap
   add ios && npx cap add android && npx cap sync` on a dev machine
   with Xcode + Android Studio. iOS Info.plist camera/library keys
   queue behind that.
4. **TestFlight + Play internal builds** behind the native projects.

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 → 0006
  must all be applied; invite-by-email still needs
  `SUPABASE_SERVICE_ROLE_KEY` + SMTP (or local supabase + inbucket).
- **Native shell** still cannot be generated in this harness (no Xcode
  / Android Studio).
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.
- **Lighthouse a11y/perf scores are not measured in CI.** Axe-core
  catches the rule-based a11y issues; the score thresholds require a
  live browser run and we don't have one in this harness.

---

## 2026-05-13 — Phase 6 continuation: Markdown ZIP import (round-trip with the export)

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kaban-phase-6-continuation-P0kwC` (session-
  assigned; stacks on `main` at `cf7fdf4` after PRs #15 and #16
  merged the previous session's camera + export work)
- **Phase**: 6 (Markdown export/import + polish)

### Goal
Ship the round-trip counterpart to the Markdown ZIP export from the
previous session: drop a `.zip` on `/boards` to create a brand-new
board, drop on `/b/[id]` to merge into the current one.

### Changed

**Core parser** (`packages/core/src/markdown-import.ts` — new)
- Pure TS, framework-free, no runtime deps. Inputs are zip entries
  (`{path, content}[]`); outputs are a normalized `ImportedBoard`
  (`{title, rows[], columns[], labels[], cards[]}`).
- `parseCardFile(content)` extracts the YAML frontmatter the
  exporter writes (always-double-quoted strings with `\\` / `\"`
  escapes, inline string arrays, bare `null`, bare UUIDs) and
  returns `{title, sourceId?, rowTitle, columnTitle, labels[],
  cover, bodyMd}`. Strips the optional `# Title` heading the
  exporter writes after the frontmatter so the round trip doesn't
  duplicate the title.
- `parseImportedBoard(entries)` walks the entries: top-level
  `README.md` yields the board title; `<row-slug>/<card>.md` files
  drive rows / columns / labels / cards (first-appearance order);
  `<row-slug>/.gitkeep` preserves empty rows. Anything else is
  silently skipped.
- CRLF tolerance up front (`\r\n` → `\n` before checking the `---`
  delimiters).
- Whitelists exactly the YAML shapes the exporter emits; throws a
  clear error on anything else so the user gets a useful message
  instead of silent data loss.
- Re-exported from `packages/core/src/index.ts`.

**Tests** (`packages/core/src/markdown-import.test.ts` — new)
- 13 tests covering: every frontmatter field, `cover: null`,
  empty body, body that lacks the `# Title` heading, `\\` and
  `\"` escapes, rejection of unknown escapes, missing frontmatter,
  missing required field, CRLF, multi-row board round-trip,
  empty-row `.gitkeep`, default title fallback, non-card path
  skipping. Total tests in `@kpu/core`: 26 (was 13).

**Server actions**
- `apps/web/app/(app)/boards/import-actions.ts` — new
  `importBoardFromZip(formData)`. Validates the file (`.zip`, ≤
  20 MB, non-empty), unzips via dynamic-imported jszip, parses,
  and inserts board → rows → columns → labels → cards →
  card_labels under the signed-in user's anon client (RLS gates
  every write). Returns the new board id so the client can
  navigate to it.
- `apps/web/app/(app)/b/[id]/import-actions.ts` — new
  `mergeBoardFromZip(boardId, formData)`. Matches existing rows /
  columns / labels by case-insensitive title; appends anything
  missing at the end. Cards always append after the current max
  position per (row, column) cell — never overwrite.

**Client UI**
- `apps/web/components/zip-dropzone.tsx` — new shared
  `<ZipDropzone>`. Window-level drag-drop listener; renders a
  full-viewport overlay only while a file is being dragged or a
  result is pending. Guards against editor-targeted drops
  (`closest('[contenteditable="true"], .ProseMirror')`) so Tiptap
  image drops on the card editor route fall through to the
  existing `onImageDropped` pipeline.
- `apps/web/app/(app)/boards/import-dropzone.tsx` — new wrapper
  that posts to `importBoardFromZip` and `router.push`es the new
  board on success.
- `apps/web/app/(app)/b/[id]/import-dropzone.tsx` — new wrapper
  that posts to `mergeBoardFromZip` and `router.refresh()`es.
- `apps/web/app/(app)/boards/page.tsx` + `b/[id]/page.tsx`
  mount their respective dropzones at the top of the page body.

**Docs**
- `docs/ROADMAP.md` — Phase 6 import box ticked; status line
  updated to reflect the round-trip being complete.
- `docs/DECISIONS/0010-markdown-zip-import.md` — added; covers
  the parser-in-core split, title-vs-id matching trade-off,
  never-overwrite-on-merge, editor-drop guard, 20 MB cap, and
  the cover-image limitation.

### Verified

- `pnpm install --frozen-lockfile` ✅ (baseline)
- `pnpm lint` ✅ (99 files; biome auto-formatted 4 files on
  first pass)
- `pnpm typecheck` ✅ (5 packages)
- `pnpm test` ✅ (26 tests in `@kpu/core` — was 13)
- `pnpm build` ✅
  - `/boards` 7.08 kB / **124 kB** First Load JS (was 5.73 kB /
    122 kB — `<ImportDropzone>` is a client component sharing the
    page chunk)
  - `/b/[id]` 138 B / **196 kB** (unchanged — dropzone is
    code-split via the import wrapper)
  - `/b/[id]/(.)c/[cardId]` + direct route **263 kB** unchanged
  - `/b/[id]/export` 135 B / **103 kB** unchanged
  - `/sign-in` 2.2 kB / **153 kB** unchanged

### ADRs added
- `docs/DECISIONS/0010-markdown-zip-import.md`

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Title-based row/column/label matching on merge**, not
  `id`-based — see ADR 0010 for the trade-off. Cross-board
  imports are the more common case; same-board re-imports just
  duplicate which is the safer failure mode.
- **Never overwrite an existing card on merge** — always append.
  Idempotent re-imports therefore produce duplicates; documented
  in the dropzone hint and in ADR 0010.
- **Parser whitelists the exporter's exact YAML subset** rather
  than depending on `js-yaml` / `yaml` (~80 kB). Throws on
  unknown shapes so we never silently mis-parse.
- **`<ZipDropzone>` guards against `[contenteditable="true"], .
  ProseMirror` targets** so the Tiptap card editor's image-drop
  pipeline keeps working when the card modal is open.
- **Cover images are not re-attached on import.** The export
  `.zip` doesn't ship binaries; round-tripping covers would need
  a different archive format. Out of scope for v1.

### Next up
1. **Page transitions + mobile modal sheets** (Phase 6b). Framer
   Motion springs only (golden rule #2). Card editor modal at
   `/b/[id]/(.)c/[cardId]` becomes a bottom-sheet on
   `(pointer: coarse)`; respect `prefers-reduced-motion`.
2. **a11y pass** (Phase 6c). Wire axe-core into CI; target
   Lighthouse a11y ≥ 95 on `/`, `/sign-in`, `/boards`, `/b/[id]`,
   `/s/[id]`.
3. **Perf pass** (Phase 6d). Biggest targets are
   `/b/[id]/c/[cardId]` (263 kB First Load JS, Tiptap-heavy) and
   `/sign-in` (153 kB). Lighthouse perf ≥ 90 on web.
4. **Native projects (still deferred)**: `cd apps/mobile && npx
   cap add ios && npx cap add android && npx cap sync` on a dev
   machine with Xcode + Android Studio. iOS Info.plist
   camera/library keys queue behind that.

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 →
  0006 must all be applied. Invite-by-email also needs
  `SUPABASE_SERVICE_ROLE_KEY` + SMTP (or local supabase +
  inbucket).
- **Native shell** still cannot be generated in this harness (no
  Xcode / Android Studio).
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.

---

## 2026-05-13 — Phase 5 closeout (camera plugin) + Phase 6 kickoff (Markdown ZIP export)

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kanban-phase-5-dev-bJXbA` (session-assigned;
  stacks on `f9c056c` — `main` after PRs #13 and #14 merged the
  previous Phase 4/5 transition work)
- **Phase**: 5 → 6 transition

### Goal
Close the last open Phase 5 functional box (camera plugin for card
image capture) and open Phase 6 with the markdown export route +
header button so any signed-in collaborator can pull a `.zip` of their
board.

### Changed

**Camera plugin** (`apps/web/lib/camera.ts` — new)
- `pickPhoto(source = 'prompt')` → `Promise<File | null>`.
- Native (`Capacitor.isNativePlatform()`): dynamic-imports
  `@capacitor/camera`, calls `Camera.getPhoto({ resultType: DataUrl,
  source: Prompt })`, decodes the data URL via `fetch().blob()`, and
  wraps the result in a synthetic `File` so the rest of the pipeline
  is platform-agnostic. Treats the cancel exception as a clean
  resolve-to-null.
- Web fallback: appends a hidden `<input type="file"
  accept="image/*" capture="environment">` to `document.body`,
  programmatically clicks it, and resolves on `change` (or on the
  next window focus with no file, to detect cancel).
- `apps/web/app/(app)/b/[id]/card-editor-modal.tsx` — new
  `<AddPhotoButton>` next to the existing Cover button, calls
  `pickPhoto` and forwards the file to the editor via a new
  `insertImageRef.current` stash.
- `apps/web/app/(app)/b/[id]/tiptap-editor.tsx` — adds
  `registerInsertImage` prop. The parent stashes the imperative
  `insert(file)` callback so external buttons can drive the editor
  without lifting tiptap state up. Same `onImageDropped` upload path is
  reused.
- `apps/web/package.json` — `+ @capacitor/camera 6.1.2`.
- `apps/mobile/package.json` — `+ @capacitor/camera 6.1.2` so
  `cap sync` ships the native plugin once the platforms are added.

**Markdown ZIP export** (`apps/web/app/(app)/b/[id]/export/route.ts` — new)
- `GET /b/[id]/export` route handler. Runs as the signed-in user; RLS
  gates the data fetch. Returns
  `Content-Type: application/zip`, `Content-Disposition: attachment;
  filename="<board-slug>.zip"`.
- Layout: top-level `README.md` (rows × columns matrix), then one
  folder per row (slugified, deduped per board), one `.md` per card
  (slugified, deduped per row). Empty rows get a `.gitkeep` so they
  still appear in the archive.
- YAML frontmatter per card: title, id, row, column, labels (array),
  cover (storage path or `null`). Body is `cards.body_md` verbatim —
  the canonical format per golden rule #5.
- `jszip@3.10.1` in-memory; compression `DEFLATE`. Lazy-imported so
  the route handler stays at 135 B build-time.
- `apps/web/app/(app)/b/[id]/export-button.tsx` — new client component
  in the board header (left of the settings gear). `fetch + blob URL`
  download so the user sees a spinner during the zip build and errors
  can be surfaced inline. Available to viewer+; owner-only stuff stays
  in `<BoardSettings>`.
- `apps/web/app/(app)/b/[id]/page.tsx` — wires `<ExportButton>` into
  the header.
- `apps/web/package.json` — `+ jszip 3.10.1`.

**Docs**
- `apps/mobile/README.md` — top-of-file checklist for the first
  developer with Xcode / Android Studio: `cap add ios`, `cap add
  android`, `@capacitor/assets generate`, `cap sync`, plus the iOS
  `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` keys
  the Camera plugin needs.
- `docs/SECURITY.md` — new "`profiles.email` (PII)" subsection under
  Logging & PII; documents that no public RLS read path exposes it,
  the only consumer is the invite server action via service-role, and
  the trigger-driven write path. Reader-of-the-future guidance: any
  new consumer stays server-side + service-role.
- `docs/ROADMAP.md` — Phase 5 camera box ticked; Phase 6 board → zip
  box ticked. Status line updated to reflect the Phase 5 → 6
  transition.
- `docs/DECISIONS/0009-camera-plugin-and-markdown-export.md` —
  added.

### Verified
- `pnpm install --frozen-lockfile` ✅ (baseline)
- `pnpm install` ✅ (after `+ @capacitor/camera`, `+ jszip`)
- `pnpm lint` ✅ (92 files; biome auto-fixed import sort + format on
  the new files)
- `pnpm typecheck` ✅ (5 packages)
- `pnpm test` ✅ (13 tests in `@kpu/core`; no new tests this session)
- `pnpm build` ✅
  - `/b/[id]` 139 B / **195 kB** First Load JS (unchanged — camera
    plugin is dynamic-imported, only loaded when the user taps Photo)
  - `/b/[id]/(.)c/[cardId]` + direct route unchanged at **263 kB**
  - `/b/[id]/export` 135 B / **103 kB** First Load JS (new; jszip is
    dynamic-imported inside the route handler)
  - `/s/[id]` unchanged at 106 kB
  - `/boards` page JS reports 5.73 kB (Next 15 caching artifact; the
    file wasn't modified this session)

### ADRs added
- `docs/DECISIONS/0009-camera-plugin-and-markdown-export.md`

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Synthetic `File` from camera data URL** instead of a base64 string
  passthrough — keeps `uploadCardImage(file, …)` the single image-
  upload entry point. The fake filename (`capture-<ms>.<ext>`) flows
  through tiptap's `alt` attribute.
- **Slug regex uses `\p{M}` with the `u` flag** to strip combining
  marks. Biome flagged the literal `[̀-ͯ]` class as misleading; the
  Unicode property is the correct fix.
- **YAML 1.2 always-double-quoted strings** for frontmatter. Lets the
  emitter sidestep block / folded / unquoted style rules entirely.
- **Route handler over server action** for the export. Server actions
  return JSON; `GET` with `Content-Disposition` is the binary-file
  shape.

### Next up
1. **Drag-drop import**: counterpart to the export. Accept either a
   single `.zip` (parse with jszip) or a folder of `.md` files (use
   the File System Access API on web; on mobile the Capacitor
   Filesystem plugin if needed). Round-trip should reconstruct row /
   column / labels / cover from the frontmatter.
2. **Native projects (still deferred)**: `cd apps/mobile && npx cap
   add ios && npx cap add android && npx cap sync` on a dev machine
   with Xcode + Android Studio. After adding, drop in
   `assets/icon.png` + `assets/splash.png` and run
   `npx @capacitor/assets generate`. Commit the generated folders.
3. **iOS Info.plist**: add the two `NSCameraUsageDescription` /
   `NSPhotoLibraryUsageDescription` keys listed in
   `apps/mobile/README.md` after `cap add ios`.
4. **Phase 6 polish**: page transitions (motion-safe), modal sheets
   on mobile (`/b/[id]/(.)c/[cardId]` → bottom-sheet on `coarse`
   pointer), reduced-motion QA, axe-core CI, Lighthouse a11y ≥ 95
   and perf ≥ 90.

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 → 0006
  must all be applied. Invite-by-email also needs
  `SUPABASE_SERVICE_ROLE_KEY` + SMTP (or local supabase + inbucket).
- **Native shell**: still cannot be generated in this harness (no
  Xcode / Android Studio). Listed as the second next-up item; iOS
  Info.plist edits queued behind it.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.

---

## 2026-05-13 — Phase 4 closeout (audit writer + invite hardening) + Phase 5 kickoff (Capacitor shell, haptics, pull-to-refresh)

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kaban-phase-4-continue-Kals8` (session-assigned;
  stacks on `08f4813` — `main` after merging the previous session's
  PRs #11 and #12, which carried the Phase 4 closeout work)
- **Phase**: 4 → 5 transition

### Goal
Drain the Phase 4 follow-ups noted in the previous handoff — audit-events
writer, invite directory lookup — then open Phase 5 with the
`apps/mobile/` Capacitor scaffold, drag haptics, and pull-to-refresh on
the boards list.

### Changed

**Schema** (`supabase/migrations/`)
- `0006_profiles_email.sql` — pins the user's email on `profiles`:
  adds a nullable `email text` column, backfills from `auth.users`,
  adds a partial unique index, rewrites `on_auth_user_created` to
  populate it on signup, and adds a `trg_auth_user_email_updated`
  trigger that propagates verified email changes.

**Types** (`packages/db/src/types.ts`)
- `profiles` gains `email`.
- `audit_events` table is now typed (`Row`, `Insert`, `Update`).

**Audit-events writer**
- `apps/web/lib/audit.ts` — new `recordAuditEvent(boardId, actorId,
  kind, payload)` helper. Uses the existing service-role admin client
  (`audit_events` has no public INSERT policy). Failures are logged
  and swallowed so audit hiccups never block the user-facing action.
  `AuditKind` union: `collaborator.invite`, `collaborator.role_update`,
  `collaborator.remove`, `share_link.rotate`, `share_link.revoke`.
- `apps/web/app/(app)/b/[id]/settings-actions.ts` — all five mutating
  server actions now call `recordAuditEvent` after the underlying
  mutation succeeds, before `revalidatePath`. `assertBoardAdmin` now
  returns the actor id to save a second `auth.getUser()` round-trip.

**Invite directory lookup**
- Replaced `admin.auth.admin.listUsers({ perPage: 200 })` with a direct
  `admin.from('profiles').select('id').eq('email', trimmedEmail).
  maybeSingle()`. Existing users → reuse the id; missing → fall through
  to `inviteUserByEmail` as before. The path no longer breaks on
  >200-user tenants.

**Mobile shell** (`apps/mobile/` — new workspace package)
- `package.json` — Capacitor 6 deps (`@capacitor/core`, `cli`, `ios`,
  `android`, `haptics`), `@kpu/config` workspace dep, `@types/node`
  for tsconfig. Scripts: `sync`, `open:ios`, `open:android`,
  `run:ios`, `run:android`, `build:web`, `typecheck`.
- `capacitor.config.ts` — `appId: app.kabanplusultra`, `webDir: 'public'`,
  opt-in `server.url` driven by `KPU_DEV_SERVER` so the native shell
  can load `pnpm dev` on LAN.
- `tsconfig.json` — extends base; types: `['node']`.
- `public/.gitkeep` — `cap sync` requires a `webDir` to exist.
- `README.md` — first-time setup walkthrough; explicitly notes that
  `ios/` and `android/` projects are added on a dev machine with
  Xcode / Android Studio via `npx cap add`.

**Haptics + drag**
- `apps/web/lib/haptics.ts` — `hapticImpact('light' | 'medium')` wraps
  `@capacitor/haptics`. Short-circuits on `prefers-reduced-motion`.
  Falls back to `navigator.vibrate` if the Capacitor web shim throws.
- `apps/web/package.json` — `+ @capacitor/core 6.2.0`,
  `+ @capacitor/haptics 6.0.2`.
- `apps/web/app/(app)/b/[id]/board-view.tsx` — `handleDragStart` fires
  a light impact when picking up a card; `handleDragEnd` fires a
  medium impact when releasing over a valid drop target.

**Pull-to-refresh on `/boards`**
- `apps/web/app/(app)/boards/pull-to-refresh.tsx` — new client
  component. Touch-only (`(pointer: coarse)`), rubber-bands at
  0.55 × deltaY, threshold 72 px, max pull 120 px. Light haptic on
  threshold-cross, medium haptic on release; calls
  `router.refresh()` and pins the spinner for 350 ms so a fast
  refresh doesn't strobe.
- `apps/web/app/(app)/boards/page.tsx` — wraps `<main>` in
  `<PullToRefresh>`.

**Docs**
- `docs/ROADMAP.md` — Phase 4 audit + invite-hardening boxes ticked;
  Phase 5 Capacitor init + haptics + pull-to-refresh boxes ticked.
  Status line updated to reflect the Phase 4 → 5 transition.
- `docs/DECISIONS/0008-audit-events-and-mobile-kickoff.md` — added.

### Verified
- `pnpm install --frozen-lockfile` ✅ (baseline)
- `pnpm install` ✅ (after dep additions; +93 packages)
- `pnpm lint` ✅ (89 files clean after biome auto-fix on imports)
- `pnpm typecheck` ✅ (5 packages now — `@kpu/mobile` joins the run)
- `pnpm test` ✅ (13 tests in `@kpu/core` still green; no new tests)
- `pnpm build` ✅
  - `/b/[id]` 139 B / **195 kB** First Load JS (up from 191 kB —
    haptics shim)
  - `/b/[id]/(.)c/[cardId]` + direct route unchanged at 263 kB
  - `/boards` 3.72 kB / **122 kB** First Load JS (up from 118 kB —
    pull-to-refresh component)
  - `/s/[id]` unchanged at 106 kB

### ADRs added
- `docs/DECISIONS/0008-audit-events-and-mobile-kickoff.md`

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Profile email is nullable** — some provider-only Supabase signups
  legitimately don't carry one. Partial unique index `where email is
  not null` is the safe shape.
- **Audit writes are fire-and-forget** — a failed `audit_events`
  insert never bubbles up; we log to stderr and return `ok: true` to
  the caller. The collaborator change is more important than the
  audit row.
- **`apps/mobile/` ships with `webDir: 'public'` (placeholder)** —
  `cap sync` needs the directory to exist; the real bundle is served
  either by Next at dev time (via `server.url`) or by a hosted/
  self-hosted instance for release builds. We did not commit
  generated `ios/`/`android/` folders because they need Xcode +
  Android Studio to create — that's a dev-machine step.

### Next up
1. **Native projects**: on a macOS box, `cd apps/mobile && npx cap add
   ios && npx cap add android && npx cap sync`. Commit the resulting
   folders. Add `assets/icon.png` + `assets/splash.png` and run
   `npx @capacitor/assets generate`.
2. **Camera plugin**: `@capacitor/camera` for capturing card images
   on mobile (Phase 5 remaining box). Web fallback is the existing
   `<input type="file" accept="image/*">`.
3. **`docs/SECURITY.md` note**: document `profiles.email` as PII;
   confirm the only consumer is the invite server action (service-
   role).
4. **Phase 6 prep**: markdown export `.zip` of `.md` files (one
   folder per row, one file per card).

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 → 0006
  must all be applied; invite-by-email additionally needs
  `SUPABASE_SERVICE_ROLE_KEY` + SMTP (or local supabase + inbucket).
- **Native shell**: cannot be generated in this harness (no Xcode /
  Android Studio). Listed as the first next-up item.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.

---

## 2026-05-12 — Phase 4 continued: invites, share links, "X is editing", label mgmt, per-cell virtualization

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/phase-4-realtime-channel-MkZ7T` (session-assigned;
  stacks on `b581c86` — the merge of the previous session's PR #9 onto
  `main`)
- **Phase**: 4 (Realtime + sharing) — all remaining checkboxes
  except large-fleet-scale invite-by-email ticked

### Goal
Close the remaining Phase 4 checkboxes: invite-by-email (service-role
admin client + `board_collaborators` upsert + role select), public
read-only share links (generate / rotate / revoke + anonymous viewer
route), the "X is editing" presence hint, a label-management surface,
and per-cell virtualization for the last unticked Phase 2 box.

### Changed

**Schema** (`supabase/migrations/`)
- `0005_share_links.sql` — `has_share_access(b)` security-definer
  helper that reads `request.headers->>'x-share-token'`; extends every
  child table's read policy with `OR has_share_access(...)` so an
  anonymous bearer of the token sees the same rows as a viewer; plus
  `rotate_share_token` and `revoke_share_token` RPCs (only the owner
  can call).

**Types** (`packages/db/src/types.ts`)
- `Functions` slot fleshed out with the two new RPCs so `supabase.rpc`
  is typed end-to-end.

**Admin client** (`apps/web/lib/supabase/admin.ts`)
- New `createAdmin()`, `import 'server-only'`, wraps the service-role
  factory from `@kpu/db`. Throws clearly if
  `SUPABASE_SERVICE_ROLE_KEY` is missing.

**Server actions** (`apps/web/app/(app)/b/[id]/settings-actions.ts` — new)
- `inviteCollaborator(boardId, email, role)` — owner/admin gate,
  `admin.auth.admin.listUsers()` lookup, falls back to
  `inviteUserByEmail` with `redirectTo` pointing back at the board,
  then upserts into `board_collaborators` (so re-invites with a new
  role work).
- `updateCollaboratorRole`, `removeCollaborator` — owner/admin gate,
  user-scoped client (RLS already restricts to admins).
- `rotateShareToken`, `revokeShareToken` — thin wrappers around the
  RPCs; return the freshly built `/s/<id>?t=<token>` URL.

**Public share viewer** (`apps/web/app/s/[id]/page.tsx` — new)
- Anonymous read-only board view. Uses `@supabase/supabase-js`
  directly with `global: { headers: { 'x-share-token': t } }` and
  `auth.persistSession: false` so no cookie ever attaches. Renders
  board title, sticky column + row headers, and cards per cell. No
  Tiptap, no dnd, no realtime — 106 kB First Load JS.
- `apps/web/lib/supabase/middleware.ts` — adds `/s/` to the public
  prefix list so the middleware doesn't redirect to `/sign-in`.

**Board settings popover** (`apps/web/app/(app)/b/[id]/board-settings.tsx` — new)
- Gear icon in the header (owner-only). Sections:
  - **Share link** — generate / rotate / revoke; one-click copy.
  - **Collaborators** — invite by email + role select; per-row role
    change + remove.
  - **Labels** — inline rename, color swatch palette, delete (with a
    confirm step). Built on top of the existing `updateLabel` and
    `deleteLabel` server actions.
- `apps/web/app/(app)/b/[id]/page.tsx` — server-loads collaborators
  (board_collaborators inner-joined to profiles) and the existing
  `share_token` column, passes both into `<BoardSettings>`.

**"X is editing" hint**
- `apps/web/app/(app)/b/[id]/presence-bus.ts` — module-level pub/sub
  for the two presence consumers that don't share a tree (the avatars
  in the header and the banner inside the parallel-route modal).
- `apps/web/app/(app)/b/[id]/presence-avatars.tsx` — tracked payload
  now carries `viewing_card_id`; the sync handler picks the most
  recent `online_at` per user so the latest tab wins; publishes the
  merged peer list to the bus.
- `apps/web/app/(app)/b/[id]/peer-editing-banner.tsx` — small banner
  inside the card modal listing other peers viewing the same card.
- `apps/web/app/(app)/b/[id]/card-editor-modal.tsx` — mounts/unmounts
  the local-viewing-card on open/close.
- `apps/web/app/(app)/b/[id]/card-modal-page.tsx` — threads
  `selfId` through so the banner can filter the current user out.

**Virtualization**
- `apps/web/package.json` — `+ @tanstack/react-virtual ^3.10.0`.
- `apps/web/app/(app)/b/[id]/board-view.tsx` — new `VirtualCardList`
  inside `Cell`. Threshold-gated at 50 cards; below that, the original
  render path is unchanged so dnd-kit can pick precise drop targets.

**Docs**
- `docs/ROADMAP.md` — Phase 4 checkboxes ticked; Phase 2 virtualization
  box closed (per-cell instead of per-board); status line updated.
- `docs/DECISIONS/0007-invites-and-share-links.md` — added.

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (83 files clean after biome auto-fix on imports)
- `pnpm typecheck` ✅
- `pnpm test` ✅ (13 tests in `@kpu/core` still green; no new tests)
- `pnpm build` ✅
  - `/b/[id]` 136 B / **191 kB** First Load JS (up from 183 kB —
    settings popover + react-virtual)
  - `/b/[id]/c/[cardId]` 132 B / **263 kB** (banner is essentially
    free)
  - `/s/[id]` 162 B / **106 kB** First Load JS (anonymous viewer)
- Manual: not exercised against Supabase — local env still missing
  keys. All routes SSR-build cleanly; share viewer renders without
  auth cookies as expected when env is wired up.

### ADRs added
- `docs/DECISIONS/0007-invites-and-share-links.md`

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Label management lives in the settings popover, not its own page**:
  one less route, the data is already loaded server-side, and the UX
  fits in the same "things-only-the-owner-touches" area as invites and
  share links. Easy to extract to `/b/[id]/labels` later if anyone
  asks.
- **`/s/[id]` uses `@supabase/supabase-js` directly, not `@supabase/ssr`**:
  the ssr client reads auth cookies, which we want to leave on the
  floor for an anonymous share-link request so the token is the only
  authorization signal.
- **`viewing_card_id` carried in the existing tracked payload**: no new
  channel — one channel multiplexes everything. The cost is a small
  schema bump in the payload that older builds can ignore.

### Next up
1. **Tail-end invite hardening**: `listUsers({ perPage: 200 })` is fine
   for self-hosted KPU but won't scale on a tenant with thousands of
   users. Replace with a directory lookup once we have something to
   look up against (or pin email in `profiles` and search there).
2. **Audit-events writer**: every invite / role change / token rotate
   should land in `audit_events`. The table exists but no code writes
   to it yet.
3. **Phase 5 prep**: `apps/mobile/` Capacitor init, `capacitor.config.ts`,
   touch-tuned drag with haptics. The board surface is now stable
   enough that the mobile shell can wrap it.

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 → 0005
  must all be applied before invites + share links + realtime light up.
  Invites additionally need `SUPABASE_SERVICE_ROLE_KEY` in the server
  env and a working SMTP (or local supabase + inbucket).
- **Share-link rate-limiting**: not in place. Supabase's RLS check is
  cheap, but a determined attacker could brute-force a 128-bit token.
  Acceptable today; revisit if we ever publish KPU.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`.

---

## 2026-05-12 — Phase 4 kickoff: per-board Realtime channel + presence avatars

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kaban-phase-3-continue-Dm3T6` (session-assigned; stacks on
  `main` at `865bbac`, the merge of PR #7 which carried Phase 3)
- **Phase**: 4 (Realtime + sharing)

### Goal
Open Phase 4 with the two pieces every other shareable surface depends on:
a per-board Supabase Realtime channel that merges remote changes into the
existing optimistic state, and a presence channel that renders live avatars
in the board header. Invite + share-link work stacks on top in the next
session.

### Changed

**Schema** (`supabase/migrations/`)
- `0004_realtime.sql` — adds `cards`, `rows`, `columns`, `labels`,
  `card_labels`, `images` to the `supabase_realtime` publication. RLS
  still gates which rows each subscriber receives; the publication only
  controls which tables are *eligible* to emit. `boards`, `profiles`,
  `audit_events`, `board_collaborators` are deliberately excluded — they
  change rarely and the existing `router.refresh()` flow covers them.

**Realtime hook** (`apps/web/app/(app)/b/[id]/use-board-realtime.ts`)
- Subscribes to a single channel `board:<id>` with six
  `postgres_changes` listeners, filtered by `board_id=eq.<id>` for the
  five tables that carry it. `card_labels` is unfiltered because the
  column lives on the joined `cards` row — RLS narrows reads, and the
  merge is idempotent.
- INSERT/UPDATE/DELETE merges into the existing setters. **UPDATE on a
  card that is actively being dragged** preserves the local
  `row_id` / `column_id` / `position` and accepts everything else, so a
  remote echo of our own optimistic move can't yank the card mid-drag.
- Fails closed when env is missing (catches `createClient()` and
  silently no-ops); local dev without Supabase is unaffected.

**Presence component**
- `presence-avatars.tsx` — joins channel `presence:<id>` keyed on
  `auth.uid()` (multiple tabs collapse to one avatar). Tracks
  `{ id, displayName, accentColor, online_at }`. Renders up to 5 round
  avatars (initials, accent background from the same 8-token palette as
  `/profile`), with a `+N` overflow chip; the current user gets a
  thinner ring.

**Board surface**
- `board-view.tsx` — lifts `labels` / `cardLabels` / `images` from
  props-only to `useState`, calls `useBoardRealtime` with
  `isCardLocked: (id) => id === activeCardId`. Drag start/end already
  flip `activeCardId`, so the lock is automatic.
- `page.tsx` — renders `<PresenceAvatars boardId me={...} />` next to
  the theme toggle in the header. Falls back to email prefix +
  `accent='indigo'` when the user's profile fields are unset.

**Docs**
- `docs/ROADMAP.md` — Phase 4 realtime + presence checkboxes ticked;
  status line bumped.
- `docs/DECISIONS/0006-realtime-and-presence.md` — added.

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (77 files clean)
- `pnpm typecheck` ✅
- `pnpm test` ✅ (13 tests in `@kpu/core` still green)
- `pnpm build` ✅
  - `/b/[id]` 136 B / **183 kB** First Load JS (up from 144 kB — about
    39 kB for the realtime client + presence avatar tracking)
  - `/b/[id]/c/[cardId]` direct + intercept routes unchanged at 262 kB
- Manual: not exercised against Supabase — local env still missing
  keys; SSR redirects to `/sign-in`. The hook silently no-ops in that
  state so the build / SSR path stays green.

### ADRs added
- `docs/DECISIONS/0006-realtime-and-presence.md`

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Drag-lock granularity**: only `activeCardId` is gated. Row /
  column / label / image UPDATEs always apply; we don't currently drag
  any of those (row + column reorder uses ▲/▼ buttons), and label edits
  are mediated by the modal which already does its own `router.refresh`.
- **Presence payload is profile-derived, not session-derived**: we send
  `{ id, displayName, accentColor }` not `{ session_id, ... }` so that
  multiple tabs from the same user merge into one avatar. The "X is
  editing" hint in `ROADMAP.md` is the natural follow-up that would
  reintroduce per-tab tracking.
- **No `boards` row in the publication**: title/cover updates from
  collaborators don't reach other clients live yet. Cheap to add when
  needed; left out for now to keep the surface minimal.

### Next up
1. **Invite collaborator by email**: server action that calls
   `auth.admin.inviteUserByEmail` (service role, server-only) and
   inserts a `board_collaborators` row keyed on the resulting user. UI
   in board settings; role select (viewer / editor / admin).
2. **Public read-only share links**: generate / rotate / revoke
   `boards.share_token`; anonymous reads use the `x-share-token` header
   that's already covered by RLS.
3. **"X is editing" hint**: when another presence-tracked user has the
   card-edit modal open, surface a small "Editing now: <name>" banner.
   Requires presence to carry a `viewing_card_id` and the avatar
   component to expose that.
4. **Label management page** (carry-over): rename / recolor / delete UI.
5. **Virtualization** (Phase 2 carry-over): `@tanstack/react-virtual`
   per-cell once a real board hits 50+ cards.

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 → 0004
  must all be applied before the live surface lights up.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`. No change.
- **Modal bundle size** unchanged from Phase 3 (262 kB First Load JS for
  the card editor route).

---

## 2026-05-12 — Phase 3 kickoff: Tiptap modal, image upload, labels + filter bar

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kaban-plus-ultra-dev-8Vmfo` (session-assigned; supersedes
  `claude/kanban-plus-ultra-dev-VNoFa` for this push)
- **Phase**: 3 (Card editor + images + labels)

### Goal
Land the Phase 3 surface — card editor in a parallel-route modal with
debounced auto-save, image paste/drag-drop to Supabase Storage with
blurhash placeholder, cover image on the card front, labels CRUD with
multi-select + filter bar — and bump Next to the patched 15.x before any
new feature code.

### Changed

**Next bump** (committed separately as `chore(deps)`)
- `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/next-env.d.ts` —
  `next` 15.1.3 → 15.5.18 (CVE-2025-66478, flagged in the previous handoff).

**Schema** (`supabase/migrations/`)
- `0003_storage_buckets.sql` — provisions `card-images` (private, 10 MB,
  image mimes), `avatars` (public read), `exports` (private) buckets and
  the matching `storage.objects` RLS policies. `card-images` writes route
  through `has_board_access(<board_id from path>, 'editor')` so the
  storage check mirrors the existing `public.images` RLS.

**Types** (`packages/db/src/types.ts`)
- Added the missing `images` table to the `Database` type definition.

**Server actions** (`apps/web/app/(app)/b/[id]/actions.ts`)
- `updateCardBody` — 64 KB cap, skips `revalidatePath` on body edits.
- `setCardCoverImage` — links/unlinks `cards.cover_image_id`.
- Label CRUD: `createLabel`, `updateLabel`, `deleteLabel`,
  `attachLabel`, `detachLabel`.
- Image lifecycle: `recordImage`, `getSignedImageUrl`.

**Parallel-route modal** (`apps/web/app/(app)/b/[id]/`)
- `layout.tsx`, `default.tsx`, `@modal/default.tsx`,
  `@modal/(.)c/[cardId]/page.tsx`, `@modal/c/[cardId]/page.tsx`,
  `card-modal-page.tsx` — see ADR 0005 for the file layout and why
  `default.tsx` re-exports `page.tsx`.

**Card editor surface** (new components)
- `card-editor-modal.tsx` — modal shell with title, label picker,
  cover-image chooser, save-status pill, upload status.
- `tiptap-editor.tsx` — Tiptap + `tiptap-markdown` + `Placeholder` +
  `Image`; paste & drop route image files through `onImageDropped`.
- `upload-card-image.ts` — client uploader. Validates mime + 10 MB cap +
  8192×8192 dim cap, computes a 4×3 blurhash via `blurhash` after
  scaling, uploads to `card-images/<boardId>/<cardId>/<uuid>.<ext>`.
  Surfaces raw Supabase errors so a missing bucket is visible to the user.
- `cover-image.tsx` — blurhash → signed-URL cross-fade.
- `label-picker.tsx`, `card-label-chips.tsx`, `label-filter-bar.tsx` —
  label CRUD picker, compact chips on card fronts, AND-filter bar above
  the grid.

**Board surface**
- `page.tsx` — fetches `labels`, `card_labels` (inner-joined to
  `cards.board_id` for RLS-safe scoping), and `images`.
- `board-view.tsx` — adds `selectedLabelIds` filter, derives maps,
  renders `LabelFilterBar`. Clicking a card opens the modal via
  `router.push('/b/<id>/c/<cardId>', { scroll: false })`; rename moves to
  double-click.
- `card-item.tsx` — cover thumbnail strip + compact label chips above
  the title.
- `types.ts` — `cover_image_id` on `CardModel`, plus `LabelModel`,
  `CardLabelLink`, `ImageModel`.

**Docs**
- `docs/ROADMAP.md` — Phase 3 checkboxes ticked.
- `docs/DECISIONS/0005-card-editor-parallel-route.md` — added.

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (75 files clean)
- `pnpm typecheck` ✅
- `pnpm test` ✅ (13 tests in `@kpu/core`)
- `pnpm build` ✅
  - `/b/[id]` First Load JS 144 kB
  - `/b/[id]/c/[cardId]` (direct) + `/b/[id]/(.)c/[cardId]` (intercept)
    First Load JS 262 kB — Tiptap is the lion's share; upload helper &
    `blurhash` are dynamic-imported from inside the modal so the board
    bundle stays at 144 kB.
- Manual: not exercised against Supabase — local env still missing keys;
  SSR routes redirect to `/sign-in` as expected.

### ADRs added
- `docs/DECISIONS/0005-card-editor-parallel-route.md`

### Delegations
None.

### Next up
- **Apply migrations** (`0001` → `0003`) once Supabase is provisioned.
  Without `0003`, the editor surfaces "Bucket not found" on image upload
  — by design.
- **Label management page** — only create + multi-select is wired into
  the card UI; rename/delete/recolor actions exist server-side and just
  need a board-settings surface.
- **Virtualization** for cells > 50 cards (`@tanstack/react-virtual`)
  remains the only unticked Phase 2 box; carry into Phase 4 unless a
  real board hits the threshold first.
- **Phase 4 — Realtime + sharing** is the next major surface: per-board
  Supabase Realtime channel, presence avatars, invite by email, role
  management, public read-only share links.

### Blockers / open questions
- **Supabase provisioning** still local-only.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`. The `prose`
  classes used by Tiptap need `@tailwindcss/typography` for full styling;
  today the editor falls back to plain styles, which is acceptable for
  v0.
- **Modal bundle size**: Tiptap is ~120 kB. If we add slash commands or
  mentions later, consider splitting the editor itself behind another
  dynamic import inside the modal route.

---

## 2026-05-12 — Handoff: PRs #4 + #5 merged, working branch synced to main

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kanban-plus-ultra-dev-VNoFa`
- **Phase**: 2 ✅ (virtualization deferred) → 3 next

### Goal
Land Phase 2 work on `main` and produce a clean handoff for the next session.

### Changed
- Fast-forwarded local `main` and `claude/kanban-plus-ultra-dev-VNoFa` onto `origin/main`. Both branches now point at `e593f65` (merge of PR #5). Working branch tip **equals main** exactly; new work for Phase 3 stacks cleanly on top.
- `CLAUDE.md`, `docs/SESSION_PROTOCOL.md`, `docs/CONTRIBUTING.md` — replaced the stale `claude/chat-analysis-app-2fsuX` references with the live `claude/kanban-plus-ultra-dev-VNoFa` branch name. Model reference in the session-log template bumped to Opus 4.7.

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (62 files)
- `pnpm typecheck` ✅
- `pnpm test` ✅ (13 tests in `@kpu/core`)
- `pnpm build` ✅ — `/b/[id]` 22.6 kB / 144 kB First Load JS; `/boards` 4.63 kB / 121 kB; middleware 62.4 kB
- `git status` clean; local + `origin` match for both `main` and the working branch.

### Final git state
| Branch | HEAD | Tracks |
|---|---|---|
| `main` (local + origin) | `e593f65` *(merge of PR #5)* | ✅ in sync |
| `claude/kanban-plus-ultra-dev-VNoFa` (local + origin) | `e593f65` | ✅ in sync, identical to main |

### ADRs added
None this session.

### Delegations
None.

### Next up
**Phase 3 — Card editor + images + labels.** Concrete sub-tasks (also in `docs/ROADMAP.md`):
1. Tiptap markdown editor in a modal. Consider Next App-Router parallel route `/b/[id]/c/[cardId]` so the modal is shareable + back-button friendly. 600 ms debounced auto-save, "saved" pulse on commit.
2. Image paste / drag-drop → Supabase Storage (`images` table already exists in `0001_init.sql`) → blurhash placeholder. Need to provision the `avatars` and `card-images` buckets per `docs/SECURITY.md` before the upload path lights up.
3. Cover image on card front (uses `cards.cover_image_id` already in schema).
4. Labels: CRUD + color picker + multi-select on cards.
5. Label filter bar above the grid.

**Carry-over from Phase 2**:
- Virtualization for cells with > 50 cards via `@tanstack/react-virtual` is the only unticked Phase 2 box. Land it once Phase 3's card editor is in or earlier if a real board hits the threshold.

### Blockers / open questions
- **Supabase provisioning** is still local-only. Migrations `0001_init.sql` + `0002_drop_board_orders.sql` need to be applied (`supabase start && supabase db reset`) before any auth/CRUD flow can be exercised end-to-end. No code blocked.
- **`next@15.1.3` has a security advisory** (CVE-2025-66478, surfaced by pnpm during install). Bump to the latest patched 15.x at the start of the next session before adding new code on top.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`; watch for stable.

---

## 2026-05-12 — Phase 2 polish: row collapse + recolor, WIP limits, ctrl-scroll zoom, schema cleanup

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kanban-plus-ultra-dev-VNoFa`
- **Phase**: 2 (Board CRUD + 2D grid) — closing out the polish items. Virtualization is the only remaining checkbox.

### Goal
Close out Phase 2: drop the redundant `boards.row_order` / `col_order` arrays, finish row collapse + recolor, column recolor + WIP limit, and add ctrl/⌘-scroll zoom with per-board persistence.

### Changed
**Schema** (`supabase/migrations/`)
- `0002_drop_board_orders.sql` — drops `boards.row_order` and `boards.col_order`; rewrites `on_auth_user_created` to stop populating them. ADR 0004 records why.
- `docs/DATA_MODEL.md` — synced `boards` table definition.

**Types + actions** (`packages/db`, `apps/web/app/(app)/b/[id]`)
- `packages/db/src/types.ts` — removed `row_order` / `col_order` from `boards`.
- `apps/web/app/(app)/boards/actions.ts:createBoard` — no longer writes the dropped columns; still seeds a default row + column.
- `apps/web/app/(app)/b/[id]/actions.ts` — new server actions: `setRowColor`, `setRowCollapsed`, `setColumnColor`, `setColumnWipLimit` (with 1–999 integer validation).

**Header UI** (`apps/web/app/(app)/b/[id]/`)
- `options-popover.tsx` — small click-outside / Escape-aware popover primitive (no extra deps).
- `swatches.ts` — single source for the 8-color palette + Tailwind class map; used by row + column headers.
- `row-header.tsx` — full rewrite. Adds a leading collapse chevron, click-to-edit title, and a `MoreHorizontal` popover with reorder buttons, 8 color swatches, and "Delete row". Delete still confirms.
- `column-header.tsx` — full rewrite. Adds an inline `{count}/{limit}` chip that highlights danger when over the WIP limit, plus a popover with reorder, color swatches, a numeric WIP limit input (blur-or-Enter commit), and "Delete column".
- `board-view.tsx` —
  - Wires the new handlers (`handleRowColorChange`, `handleRowCollapseToggle`, `handleColumnColorChange`, `handleColumnWipLimitChange`) through `RowSlice` and the headers.
  - Renders a `CollapsedCell` strip showing `N card(s)` when a row is collapsed; clicking it expands the row back.
  - Computes per-column card counts and threads them into `ColumnHeader` for the WIP chip.
  - Adds **ctrl/⌘-scroll zoom**: a non-passive `wheel` listener on the scroll container scales the grid via CSS `transform`, clamped to 0.5–1.5, debounced to `localStorage[kpu.board.<id>.zoom]`. Pinch is deferred until the Capacitor shell (Phase 5).

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (62 files clean)
- `pnpm typecheck` ✅
- `pnpm test` ✅ (13 tests in `@kpu/core` still green; no new unit tests this session)
- `pnpm build` ✅
  - `/b/[id]` 22.6 kB / 144 kB First Load JS (up from 20.8 kB / 142 kB)
  - `/boards`, `/profile`, middleware unchanged
- Manual: not exercised against Supabase this session (still local-env-missing); SSR pages redirect to `/sign-in` as designed.

### ADRs added
- `docs/DECISIONS/0004-canonical-ordering.md` — `position` (fractional) is the single source of truth for row/column/card order; `boards.row_order` / `col_order` are gone.

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **No popover library**: a 35-line `OptionsPopover` (mousedown-outside + Escape) is enough for our needs. Reconsider if Phase 3 needs combo-box or anchored menus.
- **WIP limit validation**: integer 1–999, blur-or-Enter to commit, empty input clears the limit. Server action mirrors the bounds.
- **Zoom range 0.5–1.5**: enough to show ~5–6 columns on a 15" laptop screen. We use CSS `transform: scale()` on the grid wrapper; sticky headers continue to work because the scroll container is the parent. Pinch needs `@capacitor/gestures` and lands with the mobile shell in Phase 5.
- **Collapse rendering**: collapsed rows render a single 32 px strip per cell showing card count; clicking the strip expands the row. The row header stays full-height for affordance.

### Next up
**Finish Phase 2, then start Phase 3.**
1. Virtualization for cells with > 50 cards (`@tanstack/react-virtual` per-cell list). Defer the cross-cell case until we hit a real board that needs it.
2. Phase 3 kickoff:
   - Tiptap markdown editor in a modal (`/b/[id]/c/[cardId]` parallel route?) with 600 ms auto-save and the "saved" pulse.
   - Image paste / drag-drop → Supabase Storage (`images` table already in 0001) → blurhash placeholder.
   - Labels: CRUD + multi-select + filter bar above the grid.
3. Apply `0002_drop_board_orders.sql` when the user provisions Supabase; until then, generated types stay manual.

### Blockers / open questions
- **Supabase provisioning** still local-only. Migrations 0001 + 0002 need a `supabase db reset` once the user spins up a project. No code blocked.
- **Tailwind v4 beta** still at `4.0.0-beta.7`.

---

## 2026-05-12 — Phase 2: boards CRUD, 2D grid, dnd-kit card drag

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/kanban-plus-ultra-dev-VNoFa` (stacks on top of `main` from PR #2)
- **Phase**: 2 (Board CRUD + 2D grid) — core feature surface complete; virtualization + zoom still open

### Goal
Land the headline Phase 2 surface: real `/boards` list with create/rename/delete, the `/b/[id]` 2D grid with sticky row + column headers, dnd-kit cross-cell card drag with fractional positions, and row/column CRUD with reorder.

### Changed
**Provider wiring** (`apps/web/`)
- `components/query-provider.tsx` — TanStack Query `QueryClient` provider, 30 s staleTime, no refetch-on-focus.
- `app/layout.tsx` — wraps the tree in `QueryProvider` inside `ThemeProvider`.

**Boards list** (`apps/web/app/(app)/boards/`)
- `page.tsx` — replaced the Phase 1 greeting with a real list. Server fetch via `supabase.from('boards').select('id, title, cover_color, updated_at').order('updated_at', { ascending: false })`. Renders an empty-state card or a 1–3 column grid of board cards.
- `actions.ts` — `createBoard` (inserts board + default row + default column, redirects to `/b/[id]`), `renameBoard`, `deleteBoard`. All gated on `auth.getUser()`.
- `new-board-form.tsx` — inline expand-to-input "New board" button → Server Action.
- `board-card.tsx` — cover swatch, click-through link, inline rename, confirm-delete; `useTransition` for optimistic UI.

**Board view** (`apps/web/app/(app)/b/[id]/`)
- `page.tsx` — server component; parallel fetches `boards`, `rows`, `columns`, `cards` for the requested board. 404 if board is unreadable (RLS-filtered). Sticky header bar with back link + theme toggle.
- `board-view.tsx` — client `BoardView`. CSS grid: `12rem` row-header column + N data columns + auto add-column slot. Sticky headers (`sticky left-0` / `sticky top-0`).
- `row-header.tsx`, `column-header.tsx` — inline rename via click-to-edit + ref-focus, ▲/▼ (or ◀/▶) reorder buttons using `positionBetween`, delete with confirm.
- `card-item.tsx` — drag-handle button (mounted with dnd-kit `attributes` + `listeners`), inline title rename, hover delete.
- `actions.ts` — full server-action surface: `createCard` / `moveCard` / `renameCard` / `deleteCard`, `createRow` / `renameRow` / `moveRow` / `deleteRow`, `createColumn` / `renameColumn` / `moveColumn` / `deleteColumn`. All compute positions server-side via `positionBetween(last, null)` and `revalidatePath` on success.
- `types.ts` — shared `RowModel` / `ColumnModel` / `CardModel`.

**dnd-kit wiring**
- `useDraggable` on each card, `useDroppable` on each card *and* each cell. Drop IDs: `card:<id>` → "insert before"; `cell:<rowId>:<columnId>` → "append".
- `DragOverlay` shows a ghost of the active card.
- Card move uses `useMutation` from TanStack Query so a failed move triggers `router.refresh()` for reconciliation; row/column moves and CRUD use `useTransition` + optimistic local state.

**Types** (`packages/db/src/types.ts`)
- Extended the placeholder `Database` interface with `rows`, `columns`, `board_collaborators`, `labels`, `card_labels` (matching `supabase/migrations/0001_init.sql`) so server queries are fully typed without `as any`.

**Deps** (`apps/web/package.json`)
- Added `@tanstack/react-query@5.62.0`, `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`. (Sortable isn't used yet — kept for Phase 3's label / row-sortable surfaces.)

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅ (60 files, 0 errors)
- `pnpm typecheck` ✅ (5 packages — `@kpu/config` added to scope)
- `pnpm test` ✅ (13 tests in `@kpu/core` still green; no new test files yet)
- `pnpm build` ✅ — new routes:
  - `/boards` static, 4.63 kB
  - `/b/[id]` dynamic, 20.8 kB / 142 kB First Load JS
  - Middleware still 62.4 kB
- Manual: not run end-to-end against Supabase this session (still local-env-missing); SSR pages all redirect to `/sign-in` as designed.

### ADRs added
- `docs/DECISIONS/0003-board-state-and-dnd.md` — locks in per-page `useState` + `useMutation` (cards) / `useTransition` (rows + columns) over a full TanStack-Query-as-store pattern, plus the dnd-kit droppable-ID convention (`card:<id>` vs `cell:<rowId>:<columnId>`).

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Branch**: continued on `claude/kanban-plus-ultra-dev-VNoFa` (the current working branch on remote) rather than the `claude/chat-analysis-app-2fsuX` name mentioned in `CLAUDE.md`. The renamed branch tip equals `main`, so this is the same code path; updated this entry's metadata accordingly. Next-session note: keep `CLAUDE.md` working-branch reference in sync the next time the user picks one.
- **Card editor is title-only for now**: full Tiptap markdown editor + image paste lands in Phase 3. The current click-to-rename touches only the `title` column.
- **Row / column color stays at the default seed value**. Recolor UI deferred — kept the dot indicator so the schema field is exercised.
- **Native `<input>` + ref/useEffect focus** instead of `autoFocus` (Biome a11y rule rejects `autoFocus` on raw inputs; the `@kpu/ui` `Input` wrapper isn't flagged because it's a React component, but inline edit controls didn't need the full token-styled wrapper).

### Next up
**Finish Phase 2 polish, then Phase 3 setup.**
1. Virtualization once a board exceeds ~200 cards (`@tanstack/react-virtual`) — wrap each cell's card list.
2. Pinch / ctrl-scroll zoom + per-board zoom persistence.
3. Row collapse + color picker; column color picker + WIP limit field.
4. Reconcile `boards.row_order` / `boards.col_order` arrays with the `position` numeric column. Currently the page reads `position` directly; the array is set on create but isn't kept in sync on row/column reorder. Either drop the arrays from the schema or write a trigger to keep them in sync.
5. Begin Phase 3: Tiptap markdown editor in a modal, with 600 ms auto-save and the "saved" pulse.

### Blockers / open questions
- **Supabase provisioning** still local-only. End-to-end smoke (sign-in → create board → drag card) needs `supabase start && supabase db reset` followed by `.env.local`. No code blocked.
- **`row_order` / `col_order` arrays in `boards`** are now half-used (set on create, never updated on reorder). Decide before Phase 3 whether to drop them or sync them via trigger — see "Next up" item 4.
- **Tailwind v4 beta** still at `4.0.0-beta.7`; revisit when stable ships.

---

## 2026-05-12 — Handoff: PR #2 merged, main + working branch synced

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/chat-analysis-app-2fsuX`
- **Phase**: 1 (complete) → 2 (next)

### Goal
Land Phase 0 + Phase 1 work on `main` and produce a clean handoff for the next session.

### Changed
- Opened/updated PR #2 (`claude/chat-analysis-app-2fsuX` → `main`) with a full summary; user merged it via GitHub UI.
- Locally fast-forwarded `claude/chat-analysis-app-2fsuX` onto `origin/main` so the working branch tip equals main exactly.
- Doc touch-ups in this entry, `ROADMAP.md` (status cleanup), and `CLAUDE.md` (sync note).

### Verified
- `pnpm install --frozen-lockfile` ✅
- `pnpm lint` ✅
- `pnpm typecheck` ✅ (Turbo cache hit, 4/4 packages)
- `pnpm test` ✅ (Turbo cache hit; 13 tests still green in `@kpu/core`)
- `pnpm build` ✅ (Turbo cache hit)
- `git status` clean; local and `origin` match for both `main` and the working branch.

### Final git state
| Branch | HEAD | Tracks |
|---|---|---|
| `main` (local + origin) | `7e7c5fb` *(merge of PR #2)* | ✅ in sync |
| `claude/chat-analysis-app-2fsuX` (local + origin) | `7e7c5fb` | ✅ in sync, identical to main |

The working branch is **exactly equal to main**. New work for Phase 2 stacks on top and will need a new PR.

### ADRs added
None this session.

### Delegations
None.

### Next up
**Phase 2 — Board CRUD + 2D grid.** Concretely (also in `ROADMAP.md`):
1. Add **TanStack Query** to `apps/web` and wire a server component → client provider pattern.
2. Turn `/boards` into a real list of the user's owned + shared boards (`select id, title, cover_color, updated_at from boards order by updated_at desc`).
3. "New board" button → Server Action that inserts a `boards` row + a default row and column, then redirects to `/b/[id]`.
4. `/b/[id]` with sticky row + column headers; load rows, columns, cards in parallel.
5. **dnd-kit** for cross-cell card drag with custom 2D collision detection.
6. Use `positionBetween()` / `needsRebalance()` from `@kpu/core` for ordering.
7. Optimistic mutations via TanStack Query.
8. Row + column CRUD with drag-reorder.

### Blockers / open questions
- **Supabase provisioning** is still local-only. Real magic-link emails and Google OAuth need a Supabase project. To unblock locally: `supabase start && supabase db reset` (the migration is already in place); then `cp .env.example .env.local` and fill in the URL/anon key. Not blocking code work.
- **Tailwind v4 beta** still pinned at `4.0.0-beta.7`. Watch for stable.

---

## 2026-05-12 — Phase 1: auth (magic link + Google OAuth), session middleware, profile editor

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/chat-analysis-app-2fsuX`
- **Phase**: 1 (Auth + Profile) — complete locally; avatar upload deferred to Phase 3

### Goal
Ship the full Phase 1 auth flow: Supabase SSR client trio, route-gating
middleware, `/sign-in` (magic link + Google OAuth), `/auth/callback`,
`/sign-out`, and a `/profile` editor for display name and accent color.

### Changed
**Auth wiring** (`apps/web/lib/supabase/`)
- `browser.ts` — `createBrowserClient` for Client Components
- `server.ts` — `createServerClient` for Server Components / Route Handlers (cookie store from `next/headers`)
- `middleware.ts` — `updateSession()` for the Next middleware, with env-missing pass-through for local dev
- Helper: `lib/auth.ts` — `getCurrentUser()` returns the authed user + profile or `null`; graceful when env is unset
- Helper: `lib/env.ts` — read-once env getters with clear error messages

**Routes**
- `apps/web/middleware.ts` — refresh session + gate non-public paths to `/sign-in?next=...`
- `app/sign-in/page.tsx` + `sign-in-form.tsx` — magic-link form, Google OAuth button, "check your inbox" success state
- `app/auth/callback/route.ts` — exchanges `?code=...` for a session cookie, redirects to `next` or `/boards`
- `app/sign-out/route.ts` — POST → `signOut()` → redirect home
- `app/profile/page.tsx` + `profile-form.tsx` + `actions.ts` + `accent-colors.ts` — display name (1–80 chars) + 8-preset accent picker via Server Action
- `app/(app)/boards/page.tsx` — protected landing post-auth (stub for Phase 2)
- `app/page.tsx` — landing page now switches CTA between "Sign in" and "Go to boards" based on session

**Shared UI** (`packages/ui/`)
- `Input` and `Label` primitives (radius/focus/disabled tokens matching the design system)
- Exported from `@kpu/ui` + per-component subpath exports

**Deps**: added `@supabase/ssr@0.5.2` to `apps/web`.

### Verified
- `pnpm lint` ✅
- `pnpm typecheck` ✅
- `pnpm test` ✅ (13 tests in `@kpu/core` still passing)
- `pnpm build` ✅ — routes built: `/`, `/sign-in`, `/auth/callback`, `/sign-out`, `/boards`, `/profile`, plus middleware (62.4 kB)
- `next start` smoke (port 3002):
  - `/` → 200, "Sign in" CTA visible
  - `/sign-in` → 200, magic-link form + Google button rendered
  - `/boards` (unauthed) → 307 → `/sign-in?next=/boards`
  - `/profile` (unauthed) → 307 → `/sign-in?next=/profile`
  - `/auth/callback` (no code) → 307 → `/sign-in?error=missing_code`

### ADRs added
- `docs/DECISIONS/0002-auth-with-supabase-ssr.md` — choice of `@supabase/ssr` + cookie sessions; gracefully passes through when local env is unset.

### Delegations
None.

### Decisions taken this session (small, noted inline)
- **Env-missing graceful path**: middleware short-circuits when `NEXT_PUBLIC_SUPABASE_URL` is unset so marketing surfaces still render during local scaffolding. Documented in ADR 0002 and `lib/supabase/middleware.ts`.
- **Avatar upload deferred to Phase 3**: requires Storage bucket setup (`avatars`). Profile page noted "Email and avatar come later."
- **`useSemanticElements` rule** stays disabled (from Phase 0) — same justification applies to the accent-color radiogroup.

### Next up
**Phase 2 — Board CRUD + 2D grid.** Concretely:
1. `/boards` should list the user's owned + shared boards (currently a static greeting). Query: `select id, title, cover_color, updated_at from boards order by updated_at desc`.
2. "New board" button → server action that inserts a row and redirects to `/b/[id]`.
3. `/b/[id]` board view with sticky row + column headers; load rows, columns, cards in parallel.
4. Drag-drop cards across cells using **dnd-kit** (custom 2D collision detection) + fractional indexing from `@kpu/core` (`positionBetween`, `needsRebalance`).
5. Optimistic mutations via TanStack Query.
6. Row/column CRUD with reorder.
7. Tick the Phase 2 checkboxes in `ROADMAP.md`.

### Blockers / open questions
- **Supabase provisioning**: still local-only. To exercise auth end-to-end (real magic link emails, Google OAuth callback), provision a Supabase project or run `supabase start` and configure Google OAuth in the dashboard. Code changes are not blocked.
- **TanStack Query**: not yet added — will land at the top of Phase 2 since cards need optimistic mutations.

---

## 2026-05-12 — Phase 0 scaffolding: monorepo, Next.js 15 app, first migration, green CI baseline

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/chat-analysis-app-2fsuX`
- **Phase**: 0 (Scaffolding) — complete locally

### Goal
Stand up the entire Phase 0 baseline from `docs/ROADMAP.md`: pnpm + Turborepo
monorepo, four package skeletons, the Next.js 15 web app with our design
tokens and dark-mode toggle, the first SQL migration with RLS + auth-trigger,
the GitHub Actions CI workflow, and a fully green local check pass.

### Changed
**Monorepo root**
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`
- `.gitignore`, `.env.example`

**`packages/config`** — shared Tailwind preset (radii, shadows, font tokens) + base tsconfig re-export.

**`packages/core`** — fractional-indexing helpers (`positionBetween`, `positionForAppend/Prepend`, `needsRebalance`, `rebalance`, `sortByPosition`) with **13 Vitest tests**, all passing.

**`packages/db`** — `@supabase/supabase-js` client factories (`createBrowserClient`, `createAdminClient`) with security-critical notes inline; placeholder `Database` types matching the schema in `DATA_MODEL.md`.

**`packages/ui`** — `cn()` helper (`clsx + tailwind-merge`), `Button` component with CVA variants/sizes that respect our radii + tokens.

**`apps/web`** — Next.js 15 (App Router) + React 19 + Tailwind v4 (`@theme` with our full OKLCH token set), `next-themes` provider, three-way light/system/dark `ThemeToggle`, landing page rendering the Phase 0 status with Lucide icons (stroke 1.5).

**Supabase**
- `supabase/config.toml` for local CLI use
- `supabase/migrations/0001_init.sql` — all tables (profiles, boards, rows, columns, cards, labels, card_labels, images, board_collaborators, audit_events), all indexes, RLS-enable on every table, `has_board_access()` helper, full policy set, `on_auth_user_created` trigger that seeds a demo board on signup
- `supabase/seed.sql` (placeholder)

**CI**
- `.github/workflows/ci.yml` — install → lint → typecheck → test → build on every push to `main` or `claude/**`

### Verified
- `pnpm install` ✅ (118 packages, 14.5s, no errors)
- `pnpm lint` ✅ (Biome — 32 files clean)
- `pnpm typecheck` ✅ (4 packages — `@kpu/core`, `@kpu/db`, `@kpu/ui`, `@kpu/web`)
- `pnpm test` ✅ (13 tests in `@kpu/core` pass; other packages have no tests yet)
- `pnpm build` ✅ (Next.js production build — `/` is 10.2 kB / 115 kB First Load JS)
- `pnpm dev` ✅ — server starts in 1.5s, `curl http://localhost:3000/` returns HTTP 200 with the expected strings ("Kaban Plus Ultra", "Trello at home", "swimlanes")

### Decisions taken this session (no separate ADR — minor scope)
- Tailwind v4 beta (`4.0.0-beta.7`) — v4 is the only path that supports the `@theme` directive we use for OKLCH tokens. Will pin v4 stable when it ships.
- Turned off Biome's `a11y/useSemanticElements` rule — segmented-button-group is a valid pattern for the theme toggle and shadcn/ui uses the same approach.
- Workspace package imports use bare specifiers (no `.js` suffix). `moduleResolution: Bundler` + Next's `transpilePackages` consume the TS source directly; no `.js` files exist.

### Delegations
None.

### Next up
**Phase 1 — Auth + Profile.** Concretely:
1. Wire `lib/supabase/server.ts` and `lib/supabase/browser.ts` in `apps/web` using `@kpu/db` factories. Read `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Build the `/sign-in` page: email field → magic link request + Google OAuth button.
3. `/auth/callback` route handler to exchange the code and set session cookies.
4. `middleware.ts` to gate everything except `/`, `/sign-in`, and `/auth/*` on a session.
5. `/profile` page (display name, avatar upload to `avatars` bucket, accent color picker).
6. Apply the migration locally with `supabase start && supabase db reset`; regenerate `packages/db/src/types.ts`.
7. Tick the Phase 1 checkboxes in `ROADMAP.md`.

### Blockers / open questions
- **Supabase provisioning**: still local-only. Phase 1 needs a real Supabase project (cloud or `supabase start`) and `.env.local` with real keys before sign-in can be exercised end-to-end. No code changes blocked yet.
- **Tailwind v4 beta** could ship breaking changes before stable; revisit pinning at the start of Phase 2 or sooner if a beta bump breaks the build.

---

## 2026-05-12 — Project scaffolding: master plan + documentation foundation

- **Agent / model**: Claude (Opus 4.7)
- **Branch**: `claude/chat-analysis-app-2fsuX`
- **Phase**: 0 (Scaffolding)

### Goal
Establish the documentation foundation — every markdown file specified in the
master plan — so any future session (Claude, Codex, or Gemini) can pick up
cold with full context.

### Changed
- `CLAUDE.md` — session entry point with read order, golden rules, branch conventions
- `README.md` — human-facing intro and doc links
- `docs/VISION.md` — origin story (the Regan + Cypher chat), philosophy, success criteria
- `docs/ARCHITECTURE.md` — locked stack, repo layout, data flow, runtime topology
- `docs/DESIGN_SYSTEM.md` — tokens, spacing, radii, shadows, typography, motion, components, a11y
- `docs/DATA_MODEL.md` — full SQL schema, RLS policies, helper functions, migrations policy, storage buckets
- `docs/ROADMAP.md` — 8 phases with checkboxes, current phase highlighted
- `docs/SESSION_PROTOCOL.md` — start/end checklists, session-log template, ADR template
- `docs/SESSION_LOG.md` — this file (with this entry)
- `docs/SECURITY.md` — RLS invariants, secrets handling, image upload validation, rate limits
- `docs/SELF_HOSTING.md` — Docker Compose setup stub
- `docs/CONTRIBUTING.md` — local setup, scripts, conventions
- `docs/DECISIONS/0001-stack-choices.md` — records the four big stack decisions from clarifying Qs
- `docs/AGENTS/README.md` — index of agent primers + delegation workflow
- `docs/AGENTS/SHARED_CONTEXT.md` — minimal must-know facts (stack, tokens, repo map)
- `docs/AGENTS/CODEX_PRIMER.md` — primer for Codex / ChatGPT delegations
- `docs/AGENTS/GEMINI_PRIMER.md` — primer for Gemini delegations
- `docs/AGENTS/TASK_HANDOFF_TEMPLATE.md` — fill-in-the-blank delegation template

### Verified
- All files written; structure matches the master plan §13 file list.
- No code yet — scaffolding (`pnpm` workspace + `apps/web/` Next.js + first migration) is Phase 0's next sub-task.
- Master plan saved at `/root/.claude/plans/consider-the-following-conversation-smooth-widget.md` (out-of-tree reference).

### ADRs added
- `docs/DECISIONS/0001-stack-choices.md`

### Delegations
None.

### Next up
1. Bootstrap the monorepo: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `biome.json`, `tsconfig.base.json`.
2. Scaffold `apps/web/` with Next.js 15 (App Router) + Tailwind v4 + shadcn init + theme tokens + dark mode toggle.
3. Create empty package skeletons: `packages/ui/`, `packages/core/`, `packages/db/`, `packages/config/`.
4. Write `supabase/migrations/0001_init.sql` from the schema in `DATA_MODEL.md`.
5. Add a minimal GitHub Actions workflow (`typecheck + test + lint`).
6. Get a green CI baseline. Tick off Phase 0 boxes in `ROADMAP.md`.

### Blockers / open questions
- **Supabase project**: do we provision a Supabase Cloud project now, or stay local (`supabase start`) until Phase 1? Recommendation: stay local for Phase 0, provision in Phase 1.
- **Apple Developer account**: needs to be in place before Phase 5 starts (~$99/yr, ~24h verification). Not blocking Phase 0–4.
- **Resend / SMTP** for magic links: defer until Phase 1.
