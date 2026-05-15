# Kaban Plus Ultra — Claude Session Primer

You are continuing work on **Kaban Plus Ultra** (KPU), a Trello-but-with-real-swimlanes
board app. One TypeScript codebase ships to web (desktop + mobile browser), iOS,
and Android.

## Why this exists

Born from a chat between two friends frustrated with Trello: chaotic visual
hierarchy, no real swimlanes, aggressive upsells, no good "Trello at home"
alternative. We're building the version they wanted.

See `docs/VISION.md` for the full backstory.

## Read in order at session start

1. `docs/VISION.md` — why this exists, what we're NOT building
2. `docs/ROADMAP.md` — current phase, what's done, what's next
3. `docs/SESSION_LOG.md` — read the **last entry**; that's the previous session's handoff
4. `docs/ARCHITECTURE.md` — stack + repo layout refresher
5. `docs/DATA_MODEL.md` — only if touching schema or queries
6. `docs/DESIGN_SYSTEM.md` — before any UI work
7. `docs/SECURITY.md` — before touching auth, RLS, or uploads
8. `docs/SESSION_PROTOCOL.md` — your start/end checklists

## Golden rules (non-negotiable)

1. **Simplify, simplify, simplify.** If a feature isn't on `docs/ROADMAP.md`, don't build it. When in doubt, leave it out.
2. **Springs, not tweens.** All interactive motion uses Framer Motion springs (`{ type: 'spring', stiffness: 300, damping: 30 }`). Always respect `prefers-reduced-motion`.
3. **RLS is sacred.** Never bypass Postgres Row-Level Security with the service role from client code. Server-only routes must explicitly opt in.
4. **Fractional indexing** for every ordered list (rows, columns, cards). Never renumber.
5. **Markdown is the canonical card body format.** Everything else (HTML preview, exports) is derived.
6. **Tokens, not raw values.** Colors, spacing, and radii come from the Tailwind theme — never hex literals in components.
7. **One codebase, three platforms.** Don't fork web/mobile code paths unless a Capacitor plugin is genuinely needed.

## Branch & PR conventions

- Active branch: each web session is assigned a fresh branch by the harness (e.g. `claude/kaban-plus-ultra-dev-<id>`). Honor whatever branch the system prompt names — never push to `main`. Previous session branches: `claude/chat-analysis-app-2fsuX` (Phases 0–1), `claude/kanban-plus-ultra-dev-VNoFa` (Phase 2), `claude/kaban-plus-ultra-dev-8Vmfo` (Phase 3), `claude/kaban-phase-3-continue-Dm3T6` (Phase 4 kickoff — realtime + presence), `claude/phase-4-realtime-channel-MkZ7T` (Phase 4 closeout — invites, share links, peer-editing, label mgmt, virtualization; merged via PRs #11 + #12), `claude/kaban-phase-4-continue-Kals8` (Phase 4 audit-writer + invite hardening + Phase 5 kickoff; merged via PRs #13 + #14), `claude/kanban-phase-5-dev-bJXbA` (Phase 5 closeout — camera plugin — + Phase 6 kickoff — Markdown ZIP export), `claude/kaban-phase-6-continuation-P0kwC` (Phase 6a — Markdown ZIP import; merged via PR #17), `claude/markdown-zip-import-7c2Oc` (Phase 6b/c/d — page transitions, mobile sheet, axe-core CI, lazy Tiptap; merged via PR #18), `claude/verify-supabase-connector-N1ufJ` (Phase 7 kickoff — Supabase MCP wire-up, sheet drag-dismiss, Dockerfile + compose + Caddyfile; merged via PR #19), `claude/kanban-plus-ultra-dev-sG11L` (Phase 7 main — pinned upstream Supabase at `v1.24.09` in `docker/supabase/PIN`+`fetch.sh`; `docker/kaban-stack.yml` merges via Compose `include:`; `docker/bootstrap.sh` runs `supabase/migrations/*.sql` once Postgres is healthy; `scripts/install-kaban.sh` is the `curl|sh` one-liner with DNS pre-flight + containerised JWT signing; merged via PR #21).
- Previous tips merged: `claude/kaban-plus-ultra-dev-ufORp` (Phase 7 closeout — first-run admin wizard at `/setup`, gated by `SETUP_TOKEN` env + empty-`profiles` check; `install-kaban.sh` generates a 32-char token per deploy + prints the one-time `https://<host>/setup?t=…` URL; magic-link surfaced inline on success so SMTP is optional for first-run; merged via PR #22), `claude/kaban-plus-ultra-dev-UYiN1` (Phase 7 polish — `Dockerfile.web` buildx-ready with `--platform=$TARGETPLATFORM` + `scripts/build-multiarch.sh` for `linux/amd64,linux/arm64`; healthchecked `db-backup` side-car streams gzipped `pg_dumpall` into `docker/backups/` with retention rotation; merged via PR #23), `claude/kaban-phase-7-polish-bj7Lv` (Phase 8 prep — source SVG launch assets in `apps/mobile/assets/` wired to `pnpm --filter @kpu/mobile generate:assets` (npx-driven `@capacitor/assets@3`); staged TestFlight + Play Internal release scripts `scripts/release-ios.sh` and `scripts/release-android.sh` that gate on the native folders + signing env; v1.0 release-notes draft at `docs/RELEASE_NOTES_1.0.md`; real `/legal/privacy` Next.js route stubbed from `docs/SECURITY.md` and footer-linked from `/`; merged via PR #24), `claude/phase-8-launch-prep-ud42O` (Phase 8 prep continuation — `apps/mobile/ios/ExportOptions.plist` filled with `$TEAM_ID` placeholder + `sed`-substituted in CI; `.github/workflows/release-{ios,android}.yml` workflow_dispatch-only shells around the release scripts with secret-driven signing; `docs/STORE_LISTING.md` App Store + Play listing copy draft length-checked against store caps; merged via PR #26), `claude/kaban-phase-8-continuation-enJqD` (Phase 7 hardening — migrations `0007_revoke_rpc_grants` + `0008_restore_auth_trigger_grants` revoke `EXECUTE` from `anon`/`authenticated`/`PUBLIC` on auth-trigger + share-token RPCs; advisor lints 12 → 8; merged via PR #27).
- Latest tip: `main` at `ac11c0a` (PR #27 merge). Phase 7 closed; Phase 8 prep landed; this session (`claude/continue-kaban-development-obZj7`) closed the six deferred advisor lints by adding migration `0009_private_schema_for_internal_functions`: moves `has_board_access`, `has_share_access`, `on_auth_user_created`, `on_auth_user_email_updated` into a new `private` schema (not exposed via PostgREST — usage granted to `anon`/`authenticated`/`service_role`/`supabase_auth_admin` only) and flips `rotate_share_token` + `revoke_share_token` to `SECURITY INVOKER` in `public` (their explicit owner check + the `boards_update` RLS policy already enforce authorization). Drops + recreates every RLS policy in `0001`/`0005`/`0003` with `private.` qualification in a single transaction; rewires both `auth.users` triggers. Supabase advisor drops 8 → 2 against ref `xqdhpxfgrckjzzbenivp` — only `extension_in_public` (moddatetime) + `public_bucket_allows_listing` (avatars) remain (environmental). `scripts/smoke-supabase.sh` updated to expect 404 for the relocated functions and 403 for the still-public share-token RPCs. Operator confirmed canonical domain is `kaban.saelik.com` (VPS `45.13.225.115`); privacy/STORE_LISTING/RELEASE_NOTES sweep deferred pending email-address confirmation. Captured in ADR 0021.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat(board): add row collapse`)
- Push at the end of every session. Do NOT open PRs unless explicitly asked.

## At the end of every session

1. Run `pnpm typecheck && pnpm test && pnpm lint` (once scaffolding exists). Note exact failures in the log if any.
2. Append a new entry to `docs/SESSION_LOG.md` using the template in `docs/SESSION_PROTOCOL.md`.
3. Update checkboxes in `docs/ROADMAP.md`.
4. If you made a non-obvious choice, add an ADR under `docs/DECISIONS/NNNN-title.md`.
5. Commit with a conventional-commits message. Push to the working branch.

## When delegating to Codex or Gemini

If you (Claude) hand off a discrete sub-task to another AI tool:

1. Open `docs/AGENTS/TASK_HANDOFF_TEMPLATE.md` and fill it in.
2. Paste the appropriate primer (`docs/AGENTS/CODEX_PRIMER.md` or `GEMINI_PRIMER.md`) + the filled template into that tool's session.
3. When the other agent returns code, **you** review and integrate it. Don't merge unread output.
4. Note the delegation in `docs/SESSION_LOG.md`.

## Quick file map

- `apps/web/` — Next.js 15 app (primary product surface)
- `apps/mobile/` — Capacitor shell (iOS + Android projects)
- `packages/ui/` — shadcn-based component library, shared
- `packages/core/` — domain logic (board model, markdown serdes, dnd helpers, fractional indexing)
- `packages/db/` — Supabase client + generated types + RLS SQL
- `supabase/migrations/` — timestamped SQL migrations
- `docs/` — this folder; the contract between sessions
