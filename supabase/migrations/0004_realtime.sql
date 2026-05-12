-- 0004: enable Supabase Realtime on the per-board mutable tables.
--
-- Phase 4 adds a per-board channel that listens for postgres_changes on every
-- table that BoardView holds in state. The Realtime extension only emits
-- changes for tables added to the `supabase_realtime` publication; without
-- this migration, the client subscribes successfully but never receives
-- events.
--
-- We deliberately omit `boards`, `profiles`, `audit_events`, `board_collaborators`:
--   • boards: title/cover changes are rare and can wait for `router.refresh()`.
--   • profiles: presence covers liveness; profile edits are out-of-band.
--   • audit_events: server-only, never streamed to clients.
--   • board_collaborators: invites land via `router.refresh()` after the
--     server action; no need to stream membership.
--
-- RLS still gates which rows each subscriber actually receives — the
-- publication only controls which tables are *eligible* to emit.

alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.rows;
alter publication supabase_realtime add table public.columns;
alter publication supabase_realtime add table public.labels;
alter publication supabase_realtime add table public.card_labels;
alter publication supabase_realtime add table public.images;

-- DELETE payloads only include the primary key by default. card_labels has a
-- composite PK already; the others use `id` (primary key), so REPLICA IDENTITY
-- DEFAULT is sufficient and we don't need to widen it to FULL.
