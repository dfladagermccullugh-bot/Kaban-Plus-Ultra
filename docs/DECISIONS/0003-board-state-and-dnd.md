# 0003. Board state, dnd-kit, and optimistic mutations

- **Date**: 2026-05-12
- **Status**: accepted

## Context

Phase 2 needs a real 2D grid where cards drag between cells. Three open questions
shaped the architecture:

1. Where does board state live — TanStack Query cache, React state, or a hybrid?
2. How is dnd-kit wired for cross-cell drag with fractional ordering?
3. How are mutations made optimistic without complicating rollbacks?

## Decision

**State**: per-page React `useState` seeded from a server-rendered initial fetch.
The board page (`app/(app)/b/[id]/page.tsx`) loads rows/columns/cards in parallel
via the Supabase server client, then passes them as `initialRows/Columns/Cards`
props to the `<BoardView>` client component. `BoardView` keeps three useState
arrays and a memoized `cardsByCell` map keyed by `${rowId}:${columnId}`.

**TanStack Query**: a `QueryProvider` is wired at the root layout
(`apps/web/components/query-provider.tsx`). For Phase 2 we use it just for the
card-move mutation (`useMutation` with `onError: router.refresh()`), getting
loading state and rollback-on-failure for free. Rows/columns and card create
/rename/delete use plain `useTransition` + optimistic React state updates +
`router.refresh()`. The full React-Query-cache pattern (useQuery + setQueryData
in onMutate) is overkill at the current scale; we'll revisit when realtime
arrives in Phase 4.

**dnd-kit**: pure `useDraggable` + `useDroppable` (no `@dnd-kit/sortable`).
Each card is *both* draggable and droppable; each cell is droppable.
Drop targets are encoded in IDs:
- `card:<cardId>` — drop on a card means "insert before that card".
- `cell:<rowId>:<columnId>` — drop on empty cell area means "append".

On drag end, `positionBetween(prev?.position, next?.position)` from `@kpu/core`
computes the new fractional position; the move call updates `row_id`,
`column_id`, and `position` in one shot.

**Optimistic shape**:
- Card move: setCards locally → fire mutation → on error `router.refresh()`
  to reconcile from server.
- Card/row/column create: insert a `temp-${uuid}` row optimistically; once the
  server returns the real id, swap it in.
- Renames + deletes: snapshot the original, apply the change, revert on error.

## Alternatives considered

- **TanStack Query as source of truth (`useQuery` with `initialData`)** —
  cleaner long-term but the optimistic-update API (setQueryData inside
  `onMutate`, rollback in `onError`) doubles the surface area for what is
  currently a single-tab use case. We'll switch when Phase 4 adds realtime,
  which is the natural moment to centralize cache invalidation.
- **`@dnd-kit/sortable`** — designed for 1D lists. The 2D grid would still need
  custom collision detection, and we'd lose the ability to drop on empty cells
  cleanly. Sticking to the base primitives keeps the model simple.
- **Server actions returning JSON via `useFormState`** — works but ergonomics
  for optimistic UI are noticeably worse than `useTransition` + a manual
  snapshot/revert. We'd save very little code.

## Consequences

- Single source of truth for a session is local React state; the server is the
  authority and `router.refresh()` is the reconciliation channel. Good enough
  until realtime.
- Rebalancing (`needsRebalance()` from `@kpu/core`) is not yet wired to run on
  drag-end. Phase 2 leaves this as a known follow-up; the threshold is `1e-9`
  so it won't bite for ~50 inserts between the same neighbors.
- Optimistic patches do not yet account for concurrent edits from a second
  tab; that's fine pre-Phase-4. After Phase 4 lands, the move mutation will
  need to reconcile against a Realtime subscription.
- The card editor (full markdown body, labels, images) is intentionally
  deferred to Phase 3; the current click-to-rename is a placeholder that uses
  only the `title` column.
