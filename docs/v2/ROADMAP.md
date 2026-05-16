# Roadmap

v1 is the friend-group web app, nothing else. Milestones are ordered;
each has a Definition of Done (DoD). Do not start a milestone until the
previous one's DoD is met.

## M0 — Skeleton + green pipe

The empty app boots and the one critical-path E2E is wired and green in
CI **before any product feature exists**. This milestone fixes v1's
root failure (a feedback loop the agent couldn't run).

**DoD**
- One command builds and runs the app locally (one process + one SQLite
  file; no second service).
- The single critical-path E2E (see `TESTING.md`) exists and runs
  **headless, green, in CI on every push** — even though it currently
  only walks an unimplemented happy path skeleton.
- `pnpm typecheck` / lint / the one test all green in CI.

## M1 — Claim + auth

**DoD**
- Unclaimed instance shows the claim screen; first user sets
  name+password and becomes `admin`.
- Login / logout; signed httpOnly cookie session.
- An admin can create an invite link; opening it lets a new user set
  name+password and become a `member`; token is single-use.
- No email anywhere.

## M2 — Board + the 2D grid

**DoD**
- Create a board.
- Add, rename, recolor, and reorder **rows** and **columns**; ordering
  uses string-key fractional indexing (no renumber, no rebalance).
- Grid renders as a true rows × columns matrix with calm spring motion;
  `prefers-reduced-motion` honored.

## M3 — Cards

**DoD**
- Create a card in a specific (row, column) cell.
- Edit the card's Markdown body; rendered view is derived (sanitized).
- Move a card within and across cells with optimistic UI; position is a
  fractional index within the destination cell.
- Other members see the change after a refetch (on window focus or
  interval) — no realtime service.

## M4 — Polish to "friends can actually use it"

**DoD**
- Empty states and error states for claim, login, board, grid, card.
- Mobile-web layout works (touch targets ≥ 44px).
- Design tokens applied throughout (no raw hex/px in components).
- The critical-path E2E still green in CI.

When M4's DoD is met, **v1 is done.** Stop and prove it with friends
before anything below is reconsidered.

---

## Later / Non-Goals (fenced — not v1, do not build)

File/image uploads · Markdown ZIP import/export · realtime / presence /
cursors · per-board access control · multi-board role matrices · public
share links · email / SMTP / magic links · native mobile · app-store
submission · backups-as-a-feature · analytics · audit log · teams /
orgs / billing / seats · due dates · checklists · comments / mentions ·
activity feed · automation rules · templates · calendar / timeline /
Gantt · AI features · plugins.

Anything here returns only if a real, demonstrated need appears **after**
the friend-group core is proven — and only via the high ADR bar in
`SESSION_PROTOCOL.md`.
