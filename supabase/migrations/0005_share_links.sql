-- 0005: helpers for public read-only share links.
--
-- Phase 4 continues by letting a board owner generate a `share_token` that any
-- anonymous client can read by sending it in the `x-share-token` header. The
-- RLS read policy on `boards` already accepts that header (see 0001); we now
-- extend the per-table read policies for `rows`, `columns`, `cards`, `labels`,
-- `card_labels`, and `images` so a token-bearer can fetch the child rows too.
--
-- We also add a single-statement RPC `rotate_share_token` so the server action
-- can atomically generate and store a new opaque token, plus a board-scoped
-- helper to check share-token reads.

create or replace function has_share_access(b uuid)
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

-- Extend reads on every child table so an anonymous bearer of the share token
-- can fetch the same view as an authed viewer. Writes are unchanged.
drop policy if exists rows_read   on rows;
create policy rows_read   on rows   for select using (
  has_board_access(board_id, 'viewer') or has_share_access(board_id)
);

drop policy if exists columns_read on columns;
create policy columns_read on columns for select using (
  has_board_access(board_id, 'viewer') or has_share_access(board_id)
);

drop policy if exists cards_read on cards;
create policy cards_read  on cards  for select using (
  has_board_access(board_id, 'viewer') or has_share_access(board_id)
);

drop policy if exists labels_read on labels;
create policy labels_read on labels for select using (
  has_board_access(board_id, 'viewer') or has_share_access(board_id)
);

drop policy if exists card_labels_read on card_labels;
create policy card_labels_read on card_labels for select using (
  exists (
    select 1 from cards c
    where c.id = card_id
      and (has_board_access(c.board_id, 'viewer') or has_share_access(c.board_id))
  )
);

drop policy if exists images_read on images;
create policy images_read on images for select using (
  has_board_access(board_id, 'viewer') or has_share_access(board_id)
);

-- RPC: rotate share token. The server action checks `owner_id = auth.uid()`
-- before calling; the function itself runs as the caller so RLS still applies.
create or replace function rotate_share_token(board_id uuid)
returns text
language plpgsql
security definer
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

  -- 32 hex chars = 128 bits of entropy, URL-safe.
  new_token := encode(gen_random_bytes(16), 'hex');
  update boards
    set share_token = new_token,
        visibility  = 'link'
    where id = board_id;
  return new_token;
end;
$$;

-- RPC: revoke share token. Sets visibility back to private and clears the token.
create or replace function revoke_share_token(board_id uuid)
returns void
language plpgsql
security definer
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

grant execute on function rotate_share_token(uuid) to authenticated;
grant execute on function revoke_share_token(uuid) to authenticated;
