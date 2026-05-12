# 0006. Per-board Realtime channel + presence avatars

- **Date**: 2026-05-12
- **Status**: accepted

## Context

Phase 4 needs two live surfaces:

1. **State sync** — when a collaborator moves/edits a card, every other
   open client should reflect the change without a full reload.
2. **Presence** — show who else is currently looking at the board.

Supabase exposes both over the same Realtime infrastructure: postgres
CDC (`postgres_changes`) for the first, and a presence channel for the
second. The open questions for v1:

- Should clients filter by `board_id` in the channel filter, or fetch
  everything they have access to and rely on RLS to narrow?
- How do we avoid clobbering an in-flight drag with the remote echo of
  our own optimistic move (or someone else's stale state)?
- `card_labels` has no `board_id` column — how do we scope it?

## Decision

**One channel per board** named `board:<id>`, with six `postgres_changes`
listeners (`cards`, `rows`, `columns`, `labels`, `images`, all filtered
by `board_id=eq.<id>`; plus `card_labels` *unfiltered* — RLS narrows it
because card_labels reads require board access via the `cards` join).

A separate **presence channel** `presence:<id>` carries
`{ id, displayName, accentColor }`; we render up to 5 avatars in the
board header with a `+N` overflow chip.

The realtime merge in `useBoardRealtime` follows three rules:

- **INSERT** is idempotent (skip if id already in state).
- **UPDATE** of an actively-dragged card preserves the local
  `row_id` / `column_id` / `position` and accepts everything else. The
  caller passes `isCardLocked(cardId)`; today that's the dnd-kit active
  id.
- **DELETE** removes by primary key from the local array.

Migration `0004_realtime.sql` adds the six tables to the
`supabase_realtime` publication. Without it the client subscribes but
never receives events.

## Alternatives considered

- **Channel per table** — would be redundant: one socket already
  multiplexes all six listeners, and one cleanup keeps lifetime
  management trivial.
- **Server-side filter for `card_labels`** — possible with a Postgres
  function that joins on `cards`, but not without a custom Realtime
  filter API. Easier to let RLS gate reads and accept that we'll see
  card_label events for any board the user can read (idempotent merge
  handles duplicates).
- **Replace TanStack Query cache + use realtime as the truth** — too
  invasive for Phase 4. The current optimistic state + realtime merge
  is enough; we revisit if a third writer surface lands.

## Consequences

- Anyone running KPU against a fresh Supabase project must apply
  `0004_realtime.sql` before the live experience works. The hook fails
  closed (silent skip) when env vars are missing, so local dev without
  Supabase is unaffected.
- The drag-lock rule is the **only** invariant the merge relies on; any
  other client-owned field (zoom, selectedLabelIds, etc.) lives outside
  the realtime path and is unaffected.
- Presence keys are `auth.uid()`; multiple tabs from the same user
  collapse to one avatar. Tracking per-tab is not worth the visual
  noise for v1.
