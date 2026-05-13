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

- Active branch: each web session is assigned a fresh branch by the harness (e.g. `claude/kaban-plus-ultra-dev-<id>`). Honor whatever branch the system prompt names — never push to `main`. Previous session branches: `claude/chat-analysis-app-2fsuX` (Phases 0–1), `claude/kanban-plus-ultra-dev-VNoFa` (Phase 2), `claude/kaban-plus-ultra-dev-8Vmfo` (Phase 3), `claude/kaban-phase-3-continue-Dm3T6` (Phase 4 kickoff — realtime + presence), `claude/phase-4-realtime-channel-MkZ7T` (Phase 4 closeout — invites, share links, peer-editing, label mgmt, virtualization; merged via PRs #11 + #12), `claude/kaban-phase-4-continue-Kals8` (Phase 4 audit-writer + invite hardening + Phase 5 kickoff; merged via PRs #13 + #14), `claude/kanban-phase-5-dev-bJXbA` (Phase 5 closeout — camera plugin — + Phase 6 kickoff — Markdown ZIP export), `claude/kaban-phase-6-continuation-P0kwC` (Phase 6a — Markdown ZIP import; merged via PR #17), `claude/markdown-zip-import-7c2Oc` (Phase 6b/c/d — page transitions, mobile sheet, axe-core CI, lazy Tiptap; merged via PR #18), `claude/verify-supabase-connector-N1ufJ` (Phase 7 kickoff — Supabase MCP wire-up, sheet drag-dismiss, Dockerfile + compose + Caddyfile; merged via PR #19).
- Latest tip: `claude/kanban-plus-ultra-dev-sG11L` (Phase 7 main — pinned upstream Supabase at `v1.24.09` in `docker/supabase/PIN`+`fetch.sh`; `docker/kaban-stack.yml` merges via Compose `include:`; `docker/bootstrap.sh` runs `supabase/migrations/*.sql` once Postgres is healthy; `scripts/install-kaban.sh` is the `curl|sh` one-liner with DNS pre-flight + containerised JWT signing). Stacks on `main` at `6f01fb8` (merge of PR #19). Unmerged — review/merge before the next session, or stack the new branch on top of it.
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
