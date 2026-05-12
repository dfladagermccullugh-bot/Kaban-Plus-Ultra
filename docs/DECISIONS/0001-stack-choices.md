# 0001. Initial Stack & Scope Choices

- **Date**: 2026-05-12
- **Status**: accepted

## Context

The project starts from a 2-line README. Before any code, we need to lock the
foundational choices that everything else hangs off: deployment shape, mobile
strategy, collaboration model, auth providers, swimlane semantics, v1 feature
scope, and product name. These choices were elicited in two rounds of
structured questions with the project owner.

## Decision

### Deployment
**Cloud-first, self-host friendly.** Ship to Vercel + Supabase Cloud as the
default, but provide a `docker compose up` self-host path with the same code.

### Mobile
**Capacitor 6** wrapping the Next.js web app — one TypeScript/React codebase
ships to web, iOS, and Android. We forgo the per-platform polish of true native
to get to all three surfaces in one development track.

### Collaboration
**Personal boards + invited collaborators per board.** Supabase Realtime for
live updates. Public read-only share links. **No teams / workspaces / orgs in
v1.**

### Auth
**Google OAuth + Email magic link.** No password flow. No Apple Sign-In in v1
(can be added later if iOS submission requires it — Apple only requires it
when other OAuth providers are present on iOS, so we'll revisit at Phase 5).

### Swimlanes
**Always-on 2D grid** — every board is rows × columns. Rows are collapsible
but never hidden as a concept. This is the headline product differentiator.

### v1 card features
- Title
- Rich markdown body (via Tiptap)
- Inline + cover images
- Colored labels

**Deferred to v2:** due dates, checklists, comments, mentions, activity feed.

### Markdown interop
**Export + import only** (a board → folder of `.md` files). No live two-way
filesystem sync — that's a v2+ feature.

### Product name
**Kaban Plus Ultra (KPU)** — keep the repo name.

## Alternatives considered

| Choice | Alternative | Why not |
|---|---|---|
| Cloud + self-host | Self-host only | Friction for mobile distribution; harder to onboard friends. |
| Capacitor | React Native (Expo) | More native polish but doubles the UI implementation work for v1. |
| Capacitor | True native (Swift + Kotlin) | 3× the work; unjustified at v1. |
| Personal + invites | Multi-tenant workspaces | Premature; the chat brief is "me + friends," not "company tier." |
| Magic link + Google | Password auth | Password reset / forgot flows are bug magnets we don't need. |
| Magic link + Google | Add Apple Sign-In in v1 | Only required at App Store review time; revisit at Phase 5. |
| Always-on swimlanes | Optional swimlanes per board | Two UI modes to design + test for a feature that's the product's reason for being. |
| Card scope above | Full Trello parity in v1 | Roughly +40% scope. Defer. |
| Export/import markdown | Live two-way filesystem sync | Conflict resolution is a month of work; out of v1. |

## Consequences

- **Easier:** quick path to all three platforms; clean RLS-based authorization; one design system across web + mobile.
- **Harder:** mobile drag-and-drop on a virtualized 2D grid is genuinely tricky — budget extra time in Phase 5.
- **To watch:** Supabase Realtime fan-out limits if a single board exceeds ~100 concurrent collaborators. Document the ceiling; not a v1 problem.
- **To watch:** card-body edit conflicts with last-write-wins. Acceptable for v1 (one person edits a card at a time). Revisit with Yjs CRDT if it bites in practice.
- **To watch:** Apple may require Apple Sign-In at App Store review since we ship Google OAuth on iOS. If so, add in late Phase 5.
