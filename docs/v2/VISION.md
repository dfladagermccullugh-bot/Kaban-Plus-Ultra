# Vision

**Kanban Plus Ultra is a calm, self-hostable Kanban board with real
swimlanes — a true 2D grid of rows × columns — that a small group of
friends can stand up in one step and use together.**

## Who it's for

A handful of people who trust each other — friends, partners, a tiny
team — running one shared instance. One deploy serves one group. Not an
enterprise, not the public internet, not strangers.

## The feel

- **The board is the product.** Everything else is plumbing and stays out
  of the way.
- **Calm, not busy.** One accent color. Few shadows, few radii. No visual
  chaos, no upsells, no nags.
- **Motion is communication.** Spring-based motion answers "what just
  happened?" / "where did it go?" — never decoration. Always honor
  `prefers-reduced-motion`.
- **Touch first, mouse second, keyboard always.**
- **Own your data.** It's your instance, your file, forever.

## What makes it different

Real swimlanes. A card lives in a cell at the intersection of a **row**
(swimlane) and a **column** — a genuine 2D grid, not Trello's flat lists
with cards faking lanes.

## Non-Goals (explicitly NOT building)

- Multi-tenant SaaS, orgs/workspaces, billing, seats
- Public sign-up; anyone-can-join; per-board access control or
  multi-board role matrices (one instance = one trusted group; all
  members see all boards in v1)
- Email / SMTP / magic links (v1 auth is password + invite tokens)
- Live realtime multiplayer, presence, cursors
- File/image uploads (markdown may link external image URLs)
- Markdown ZIP import/export, backups-as-a-feature, analytics, audit log
- Native mobile apps, app-store submission
- Due dates, checklists, comments, mentions, activity feed
- Automation rules, templates, calendar/timeline/Gantt, AI, plugins

> Anything not in the roadmap is a "no" until it's a "yes." When in
> doubt, subtract.
