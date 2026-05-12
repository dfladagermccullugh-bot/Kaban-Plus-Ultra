# 0004. Canonical ordering lives in `position`; drop `boards.row_order` / `col_order`

- **Date**: 2026-05-12
- **Status**: accepted

## Context

The initial schema (migration `0001_init.sql`) carried both:

1. A numeric `position` column on each `rows` / `columns` / `cards` row, used
   with the fractional-indexing helpers in `@kpu/core`.
2. `uuid[]` arrays `boards.row_order` and `boards.col_order` containing the
   ordered row/column ids.

Phase 2 wired everything (sticky headers, dnd-kit, reorder buttons) to
`position`. The arrays were set once on board create and never updated on
reorder — a drift bug waiting to happen.

## Decision

Drop the arrays. The `position` numeric column is the canonical ordering for
every list (rows, columns, cards) in KPU. Migration `0002_drop_board_orders.sql`
removes the columns and rewrites the `on_auth_user_created` trigger so it no
longer references them.

## Alternatives considered

- **Keep both, sync via triggers** — doubles the write path and gives two
  sources of truth that can diverge under concurrent writes. The arrays would
  be redundant: any UI that needs an order already reads `position` and sorts.
- **Use only the arrays (no `position`)** — would force whole-board UPDATEs on
  every reorder and break the fractional-indexing model from `@kpu/core`. Also
  loses cheap "insert between two items" semantics.

## Consequences

- One source of truth. Reorder is a single-row UPDATE; concurrent reorders
  resolve cleanly because each writer sees its own fractional position.
- Migration `0002` is non-reversible from data alone (the array values are
  gone), but is safe because `position` was always the authority in Phase 2
  code. No app code needs to be backported.
- Realtime in Phase 4 only needs to subscribe to `rows`, `columns`, `cards`;
  it doesn't have to watch a separate "ordering" message on `boards`.
- The schema in `docs/DATA_MODEL.md` now matches the live tables.
