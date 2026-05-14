# Vision

## The origin

This project began as a chat between two friends, F1 and F2:

- **F1**: *"man trello just always looks like chaos to my brain"*
- **F1**: *"see you guys have pseudo 'swimlanes' for each column that indicate the state of things"*
- **F2**: *"Just cards acting as separators"*
- **F1**: *"I just need trello with swimlanes"*
- **F2**: *"Can't just vibe code one?"*
- **F1**: *"you know how trello has columns? what if it had rows too to separate different things? simple concept, rarely executed well."*
- **F2**: *"I just feel this recurring pattern. Any subscription you think you like eventually gets flipped upside down and they take advantage of you."*
- **F1**: shares `https://github.com/obsidian-community/obsidian-kanban`
- **F2**: *"Image support would be nice."*
- **F2**: shares Trello upsell screenshot. *"We need our own 'Trello'."*
- **F2**: *"Can't we 'have Trello at home?'"*

That chat is the spec.

## What we are building

**Kaban Plus Ultra (KPU)** — a board app where:

- Every board is a **true 2D swimlane grid**: rows × columns, not Trello's separator-card hack.
- **Cards are markdown** with inline and cover image support.
- **Sharing is per-board**, invite-by-email, no seat caps, no upsells.
- **One codebase** runs on the web, iOS, and Android.
- **Self-hostable** via a single `docker compose up`.

## Guiding philosophy

> "Simplify, simplify, simplify." — Steve Jobs (paraphrased)

- **Apple HIG meets Material 3.** Clarity, deference, depth. Motion as feedback, elevation as hierarchy.
- **Restraint over decoration.** Two shadow tokens. Three radius tokens. One accent color. No gradients on cards.
- **Springs over tweens.** Motion mirrors physical reality.
- **The board is the product.** Everything else is plumbing.

## Who it's for (v1)

- A solo user who wants a personal planning surface that's fast and pretty.
- Two-to-five-person groups (friends, partners, tiny startups) collaborating on shared boards.
- Self-hosters who want to own their data and never see a "Upgrade workspace" modal.

## What we are NOT building (v1)

To honor the philosophy, the following are explicitly **out of scope** for v1:

- Due dates, checklists, comments, mentions, activity feed UI
- Teams / workspaces / orgs / billing seats
- Multiple workspaces per user
- Card templates
- Automation rules (Trello "Butler")
- Calendar / timeline / Gantt views
- Live two-way markdown filesystem sync (export/import only is in scope)
- AI-generated cards or summaries
- Plugin marketplaces

Anything not on the roadmap is a "no" until it's a "yes." See `ROADMAP.md`.

## Success criteria for v1

A new user can:

1. Sign in with Google or an email magic link in under 15 seconds.
2. Create a board, add 3 rows and 4 columns, add 5 cards across cells, all under 60 seconds.
3. Drag a card to a new (row, column) cell on any device (desktop, iPhone, Android) with smooth 60fps motion and the change appearing instantly on a friend's screen.
4. Paste an image into a card body and see it render in the preview.
5. Share the board with a friend via a link, with read-only or editor access of their choice.
6. Export the entire board as a folder of `.md` files.

If all six work and feel polished, v1 ships.
