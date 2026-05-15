-- 0009_private_schema_for_internal_functions.sql
--
-- Closes the remaining 6 actionable Supabase security advisor lints
-- (4 on `has_*_access`, 2 on `rotate/revoke_share_token`) by:
--
-- 1. Moving the four internal `SECURITY DEFINER` functions
--    (`has_board_access`, `has_share_access`, `on_auth_user_created`,
--    `on_auth_user_email_updated`) into a new `private` schema that is NOT
--    exposed via PostgREST. The advisor only flags DEFINER functions in
--    schemas reachable via `/rest/v1/rpc/*` — once they live in `private`,
--    the lints disappear.
-- 2. Flipping `rotate_share_token` + `revoke_share_token` to
--    `SECURITY INVOKER`. Both functions already check `owner_id = auth.uid()`
--    and the underlying `UPDATE` is independently constrained by the
--    `boards_update` RLS policy, so the DEFINER privilege wasn't actually
--    needed — the lint disappears once the function is INVOKER.
--
-- RLS policies in `public` (boards, board_collaborators, rows, columns,
-- cards, labels, card_labels, images, audit_events) and the two
-- `storage.objects` policies on `card-images` all reference the helpers
-- and are dropped+recreated with `private.` qualification.
--
-- The two `auth.users` triggers are dropped, the function bodies are moved
-- verbatim into `private`, and the triggers are recreated calling the new
-- locations. `supabase_auth_admin` keeps `EXECUTE` so signups still fire.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Create the `private` schema
-- ─────────────────────────────────────────────────────────────────────────

create schema if not exists private;

-- USAGE on the schema is required for any role that calls a function in it
-- (RLS expressions for `anon`/`authenticated`; auth admin for triggers).
-- PostgREST exposure is controlled separately by db.api.schemas and remains
-- `public`-only, so granting USAGE here does NOT expose the schema as an API.
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role, supabase_auth_admin;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Drop every RLS policy that references public.has_*_access
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists boards_read   on public.boards;
drop policy if exists boards_update on public.boards;

drop policy if exists collab_read   on public.board_collaborators;
drop policy if exists collab_write  on public.board_collaborators;

drop policy if exists rows_read     on public.rows;
drop policy if exists rows_write    on public.rows;

drop policy if exists columns_read  on public.columns;
drop policy if exists columns_write on public.columns;

drop policy if exists cards_read    on public.cards;
drop policy if exists cards_write   on public.cards;

drop policy if exists labels_read   on public.labels;
drop policy if exists labels_write  on public.labels;

drop policy if exists card_labels_read  on public.card_labels;
drop policy if exists card_labels_write on public.card_labels;

drop policy if exists images_read   on public.images;
drop policy if exists images_write  on public.images;

drop policy if exists audit_read    on public.audit_events;

drop policy if exists "card_images_read"  on storage.objects;
drop policy if exists "card_images_write" on storage.objects;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Drop the public helper functions and recreate them in `private`
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.has_board_access(uuid, text);
drop function if exists public.has_share_access(uuid);

create or replace function private.has_board_access(b uuid, min_role text default 'viewer')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from boards
    where id = b
      and (
        owner_id = auth.uid()
        or exists (
          select 1 from board_collaborators
          where board_id = b
            and profile_id = auth.uid()
            and case min_role
                  when 'viewer' then role in ('viewer','editor','admin')
                  when 'editor' then role in ('editor','admin')
                  when 'admin'  then role = 'admin'
                end
        )
      )
  );
$$;

create or replace function private.has_share_access(b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from boards
    where id = b
      and visibility = 'link'
      and share_token is not null
      and share_token = current_setting('request.headers', true)::jsonb->>'x-share-token'
  );
$$;

-- RLS expressions are evaluated as the calling role (anon / authenticated
-- for end-user reads, service_role for server actions). EXECUTE on the
-- helpers must be granted to those roles or the policy check errors out.
revoke all on function private.has_board_access(uuid, text) from public;
revoke all on function private.has_share_access(uuid) from public;
grant execute on function private.has_board_access(uuid, text) to anon, authenticated, service_role;
grant execute on function private.has_share_access(uuid) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Recreate every RLS policy using private.* qualification
-- ─────────────────────────────────────────────────────────────────────────

-- boards
create policy boards_read on public.boards for select using (
  private.has_board_access(id, 'viewer')
  or (
    visibility = 'link'
    and share_token is not null
    and share_token = current_setting('request.headers', true)::jsonb->>'x-share-token'
  )
);
create policy boards_update on public.boards for update
  using (owner_id = auth.uid() or private.has_board_access(id, 'admin'));

-- board_collaborators
create policy collab_read on public.board_collaborators for select using (
  profile_id = auth.uid() or private.has_board_access(board_id, 'viewer')
);
create policy collab_write on public.board_collaborators for all
  using (private.has_board_access(board_id, 'admin'))
  with check (private.has_board_access(board_id, 'admin'));

-- rows
create policy rows_read on public.rows for select using (
  private.has_board_access(board_id, 'viewer') or private.has_share_access(board_id)
);
create policy rows_write on public.rows for all
  using (private.has_board_access(board_id, 'editor'))
  with check (private.has_board_access(board_id, 'editor'));

-- columns
create policy columns_read on public.columns for select using (
  private.has_board_access(board_id, 'viewer') or private.has_share_access(board_id)
);
create policy columns_write on public.columns for all
  using (private.has_board_access(board_id, 'editor'))
  with check (private.has_board_access(board_id, 'editor'));

-- cards
create policy cards_read on public.cards for select using (
  private.has_board_access(board_id, 'viewer') or private.has_share_access(board_id)
);
create policy cards_write on public.cards for all
  using (private.has_board_access(board_id, 'editor'))
  with check (private.has_board_access(board_id, 'editor'));

-- labels
create policy labels_read on public.labels for select using (
  private.has_board_access(board_id, 'viewer') or private.has_share_access(board_id)
);
create policy labels_write on public.labels for all
  using (private.has_board_access(board_id, 'editor'))
  with check (private.has_board_access(board_id, 'editor'));

-- card_labels
create policy card_labels_read on public.card_labels for select using (
  exists (
    select 1 from public.cards c
    where c.id = card_id
      and (private.has_board_access(c.board_id, 'viewer') or private.has_share_access(c.board_id))
  )
);
create policy card_labels_write on public.card_labels for all
  using (exists (
    select 1 from public.cards c where c.id = card_id and private.has_board_access(c.board_id, 'editor')
  ))
  with check (exists (
    select 1 from public.cards c where c.id = card_id and private.has_board_access(c.board_id, 'editor')
  ));

-- images
create policy images_read on public.images for select using (
  private.has_board_access(board_id, 'viewer') or private.has_share_access(board_id)
);
create policy images_write on public.images for all
  using (private.has_board_access(board_id, 'editor'))
  with check (private.has_board_access(board_id, 'editor'));

-- audit_events (read-only; writes are service-role)
create policy audit_read on public.audit_events for select using (
  private.has_board_access(board_id, 'viewer')
);

-- storage.objects — card-images bucket
create policy "card_images_read"
  on storage.objects for select
  using (
    bucket_id = 'card-images'
    and exists (
      select 1 from public.images i
      where i.storage_path = storage.objects.name
        and private.has_board_access(i.board_id, 'viewer')
    )
  );

create policy "card_images_write"
  on storage.objects for all
  using (
    bucket_id = 'card-images'
    and private.has_board_access((split_part(name, '/', 1))::uuid, 'editor')
  )
  with check (
    bucket_id = 'card-images'
    and private.has_board_access((split_part(name, '/', 1))::uuid, 'editor')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Move auth.users trigger functions into private + rewire triggers
-- ─────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_auth_user_created       on auth.users;
drop trigger if exists trg_auth_user_email_updated on auth.users;
drop function if exists public.on_auth_user_created();
drop function if exists public.on_auth_user_email_updated();

create or replace function private.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_board_id uuid;
  row_todo  uuid := gen_random_uuid();
  row_doing uuid := gen_random_uuid();
  row_done  uuid := gen_random_uuid();
  col_now   uuid := gen_random_uuid();
  col_next  uuid := gen_random_uuid();
  col_later uuid := gen_random_uuid();
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    lower(new.email)
  );

  insert into boards (owner_id, title, description, cover_color)
  values (
    new.id,
    'Welcome to Kaban',
    'A demo board to play with. Drag a card to a new cell.',
    'indigo'
  )
  returning id into new_board_id;

  insert into rows (id, board_id, title, color, position) values
    (row_todo,  new_board_id, 'To do',  'slate', 0),
    (row_doing, new_board_id, 'Doing',  'amber', 1),
    (row_done,  new_board_id, 'Done',   'green', 2);

  insert into columns (id, board_id, title, color, position) values
    (col_now,   new_board_id, 'Now',    'indigo', 0),
    (col_next,  new_board_id, 'Next',   'indigo', 1),
    (col_later, new_board_id, 'Later',  'indigo', 2);

  insert into cards (board_id, row_id, column_id, title, body_md, position, created_by) values
    (new_board_id, row_todo,  col_now,  'Try dragging me',
       'Move me to a different cell. The grid is the product.', 0, new.id),
    (new_board_id, row_doing, col_next, 'Markdown is welcome',
       '**Bold**, _italic_, and `code` all work. Paste an image too.', 0, new.id),
    (new_board_id, row_done,  col_later, 'You made it',
       'Welcome to Kaban Plus Ultra.', 0, new.id);

  return new;
end;
$$;

create or replace function private.on_auth_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update profiles
       set email = lower(new.email)
     where id = new.id;
  end if;
  return new;
end;
$$;

-- Triggers fire as `supabase_auth_admin`. The two functions are only ever
-- called via those triggers — no role except the auth admin needs EXECUTE.
revoke all on function private.on_auth_user_created()       from public;
revoke all on function private.on_auth_user_email_updated() from public;
grant execute on function private.on_auth_user_created()       to supabase_auth_admin;
grant execute on function private.on_auth_user_email_updated() to supabase_auth_admin;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function private.on_auth_user_created();

create trigger trg_auth_user_email_updated
  after update of email on auth.users
  for each row execute function private.on_auth_user_email_updated();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Flip rotate/revoke_share_token to SECURITY INVOKER (stays in public)
-- ─────────────────────────────────────────────────────────────────────────
--
-- These RPCs are called from the `settings-actions.ts` server action under
-- an `authenticated` cookie. Under INVOKER:
--   - `auth.uid()` resolves the caller's JWT sub (same as DEFINER).
--   - The existence-check SELECT runs through the `boards_read` RLS policy,
--     which allows owners (via private.has_board_access).
--   - The UPDATE runs through the `boards_update` RLS policy, which allows
--     `owner_id = auth.uid()` — the function already verifies that above,
--     so the policy check is guaranteed to pass.
--
-- DEFINER was never required here; switching to INVOKER closes the
-- `authenticated_security_definer_function_executable` lint.

drop function if exists public.rotate_share_token(uuid);
drop function if exists public.revoke_share_token(uuid);

create or replace function public.rotate_share_token(board_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_token text;
begin
  if not exists (
    select 1 from boards where id = board_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the board owner can rotate the share token.';
  end if;

  new_token := encode(gen_random_bytes(16), 'hex');
  update boards
    set share_token = new_token,
        visibility  = 'link'
    where id = board_id;
  return new_token;
end;
$$;

create or replace function public.revoke_share_token(board_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from boards where id = board_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the board owner can revoke the share token.';
  end if;
  update boards
    set share_token = null,
        visibility  = 'private'
    where id = board_id;
end;
$$;

revoke all on function public.rotate_share_token(uuid) from public, anon;
revoke all on function public.revoke_share_token(uuid) from public, anon;
grant execute on function public.rotate_share_token(uuid) to authenticated, service_role;
grant execute on function public.revoke_share_token(uuid) to authenticated, service_role;
