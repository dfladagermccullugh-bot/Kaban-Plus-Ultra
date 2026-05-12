-- 0003: provision Supabase Storage buckets used by Phase 3+.
--
-- Buckets (see docs/DATA_MODEL.md §Storage):
--   • card-images  — private (signed URLs), inline card images + covers
--   • avatars      — public read, profile avatars
--   • exports      — private, one-off markdown zips with short TTL
--
-- Policies follow the rule from docs/SECURITY.md: a row exists in `public.images`
-- iff the user already has at least `editor` access to the parent board, so the
-- storage policy delegates authorization to `has_board_access` keyed on
-- `images.storage_path`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('card-images', 'card-images', false, 10 * 1024 * 1024,
   array['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars',     'avatars',     true,  2  * 1024 * 1024,
   array['image/jpeg','image/png','image/webp']),
  ('exports',     'exports',     false, 50 * 1024 * 1024, null)
on conflict (id) do nothing;

-- ── card-images policies ────────────────────────────────────────────────────
-- Reads: any board member (viewer+) can fetch via signed URL.
create policy "card_images_read"
  on storage.objects for select
  using (
    bucket_id = 'card-images'
    and exists (
      select 1 from public.images i
      where i.storage_path = storage.objects.name
        and public.has_board_access(i.board_id, 'viewer')
    )
  );

-- Writes: only editors+ can insert/update/delete an object. The matching
-- `public.images` row is inserted in the same transaction as the upload via a
-- server action; the RLS on `public.images` already requires editor access, so
-- the storage policy can mirror that check by looking up the eventual board_id
-- from the path prefix ("<board_id>/...").
create policy "card_images_write"
  on storage.objects for all
  using (
    bucket_id = 'card-images'
    and public.has_board_access(
      (split_part(name, '/', 1))::uuid, 'editor'
    )
  )
  with check (
    bucket_id = 'card-images'
    and public.has_board_access(
      (split_part(name, '/', 1))::uuid, 'editor'
    )
  );

-- ── avatars policies ────────────────────────────────────────────────────────
create policy "avatars_read_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Each user can only write objects under their own user id prefix.
create policy "avatars_write_own"
  on storage.objects for all
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── exports policies ────────────────────────────────────────────────────────
-- Exports are written by Edge Functions (service role) and read by the owner
-- via signed URL. No public policies — Storage rejects all non-service access
-- by default with RLS enabled.
