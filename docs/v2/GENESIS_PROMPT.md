# Genesis Prompt — Build Kanban Plus Ultra (v1)

You are the Build Agent. You have **no prior context** and you need none.
Everything required is this prompt plus its nine sibling documents in
this folder. Do not look for an older codebase, old ADRs, or a prior
conversation — they are not part of this build and must not influence it.

## Objective

Build **Kanban Plus Ultra**: a calm, self-hostable Kanban board with
**real swimlanes** — a true 2D grid of rows × columns (not flat lists
with cards faking lanes) — that a small group of friends can stand up in
one step and use together. One TypeScript codebase, web only.

## Prime Directive (governs every decision)

**Radical operational simplicity is the product.** A non-technical user
stands up a working instance in effectively one command. A developer
runs and fully tests the entire critical path locally and headless in CI
with no exotic infrastructure and no human in the loop. Any feature,
dependency, service, container, or env var that cannot meet this bar does
not ship in v1. **When in doubt, subtract.** If a design can't be
defended against this directive in one sentence, it is wrong.

## Read these first (they are the whole spec)

In this folder, in order:

1. `VISION.md` — what it is, who it's for, the feel, Non-Goals.
2. `PRINCIPLES.md` — the testable rules every decision is checked
   against.
3. `ARCHITECTURE.md` — the minimal stack and the single-origin design.
4. `DATA_MODEL.md` — entities, fractional indexing, the access model.
5. `ROADMAP.md` — milestones M0–M4 with Definitions of Done.
6. `DEPLOY.md` — the one-step install / one-command dev / CI path.
7. `TESTING.md` — the one critical-path E2E and the test anti-goals.
8. `SESSION_PROTOCOL.md` — start/end checklist and the high ADR bar.
9. `LESSONS_FROM_V1.md` — why these constraints exist; do not soften
   them without reading this.

## The architecture in one paragraph (full detail in `ARCHITECTURE.md`)

One Next.js app (App Router) is the entire system. It serves UI + API
from **one origin** and opens **embedded SQLite** by file path — never a
network origin. There is **no second service**, no gateway, no reverse
proxy required for correctness, and **no origin-rewrite helper anywhere
(forbidden)**. Auth is first-party: argon2/bcrypt password hash in the
DB, signed httpOnly cookie session; **no email/SMTP**. The first visitor
*claims* the instance (sets admin password); members join via single-use
invite links built from one `APP_URL` env var. Card body is canonical
Markdown text, rendered with a sanitizing renderer. Ordering of rows,
columns, and cards uses **string-key fractional indexing** (a library
like `fractional-indexing`) — never renumber, never a rebalance job.
**No realtime** (optimistic UI + refetch on focus). **No uploads**
(markdown may link external image URLs). Config is exactly three vars:
`APP_URL`, `DATABASE_PATH`, `SESSION_SECRET`.

## Order of work (do not reorder; finish a milestone's DoD before the next)

**M0 first and non-negotiable: build the feedback loop before the
product.** Scaffold the app so it boots from one command, wire the single
Playwright critical-path E2E from `TESTING.md` (it walks the happy path
even though screens are stubs), and make `typecheck` + lint + that one
E2E run **green, headless, in CI on every push**. v1's predecessor died
because the agent could not test the deploy path; you fix that on day
one. Then M1 (claim + auth), M2 (board + 2D grid), M3 (cards), M4
(polish), each to the Definition of Done in `ROADMAP.md`.

## Hard prohibitions (scope creep is how the last attempt failed)

- Build **nothing** in `ROADMAP.md` → Later / Non-Goals. Not "a little."
  Not "while I'm here." Nothing.
- No second service/container/process. No gateway. No SMTP. No realtime
  service. No object storage. No origin-rewrite helper.
- No env var beyond the three named ones without justifying it against
  the Prime Directive in `ARCHITECTURE.md`.
- No test beyond the one E2E unless it cites the critical path or a
  failure that already burned the build (`TESTING.md`).
- No ADR for a bug fix. ADRs only for structural, hard-to-reverse
  choices (`SESSION_PROTOCOL.md`).
- No speculative abstraction, no "might need it later" layer, no
  refactor smuggled inside a bug fix. Boring and small wins.
- Do **not** open a pull request unless explicitly asked. Commit
  (Conventional Commits) and **push** at the end of every session — the
  environment is ephemeral.

## Design tokens (use these exact values; reference tokens, never raw values)

**Color (OKLCH; light / dark):**

| Token | Light | Dark |
|---|---|---|
| `bg` | `oklch(99% 0 0)` | `oklch(15% 0.01 264)` |
| `bg-elevated` | `oklch(100% 0 0)` | `oklch(18% 0.01 264)` |
| `surface` | `oklch(97% 0.005 264)` | `oklch(22% 0.01 264)` |
| `border` | `oklch(92% 0.005 264)` | `oklch(28% 0.01 264)` |
| `text` | `oklch(20% 0.02 264)` | `oklch(96% 0.005 264)` |
| `text-muted` | `oklch(55% 0.02 264)` | `oklch(70% 0.01 264)` |
| `accent` | `oklch(60% 0.18 264)` (indigo, default) | same |
| `danger` | `oklch(60% 0.22 25)` | same |
| `success` | `oklch(65% 0.16 145)` | same |

Accent presets (user-selectable, same lightness/chroma family): indigo
(default), blue, teal, green, lime, amber, rose, violet.

**Spacing — 4px grid:** 1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48 (px).

**Radii — exactly three:** `sm`=12px (cards, buttons, labels), `md`=16px
(modals, popovers, sheets), `lg`=20px (full-screen surfaces).

**Shadows — exactly two:** `sm` = `0 1px 2px oklch(0% 0 0 / 0.06)`
(resting card); `md` = `0 8px 24px oklch(0% 0 0 / 0.12)` (dragging card,
open modal).

**Typography:** UI = Inter Variable (400/500/600/700); code = JetBrains
Mono Variable. Sizes: 12/14/16/18/20/24/30 px. Line height 1.2 headings,
1.5 body. Card title = 16px semibold; card body = 14px rendered markdown.
Never more than 3 sizes per screen.

**Touch targets:** ≥ 44×44 px. **Icons:** one icon set, 1.5 stroke;
16 inline / 20 button / 24 header.

**Motion (Framer Motion springs only — no eased tweens for interaction;
always honor `prefers-reduced-motion`):**

| Use | stiffness | damping |
|---|---|---|
| Default UI | 300 | 30 |
| Heavy surface (modal/sheet) | 220 | 28 |
| Snappy (toggle) | 500 | 30 |
| Drag follow | 600 | 40 |

All animations ≤ 400ms. Reduced motion: non-essential motion off; state
changes become instant; drag layout uses a <80ms cross-fade, not a
spring.

## Definition of Done for v1

`ROADMAP.md` M4's DoD is met, the single critical-path E2E is green
headless in CI, and a non-technical user can run `DEPLOY.md`'s one
command and use the board with friends. Then stop and prove it with real
users before reconsidering anything fenced as Later.

You have everything. Start with M0: make the loop you can test, then
build the smallest board that delights a few friends.
