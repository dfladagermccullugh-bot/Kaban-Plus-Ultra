-- 0001_init.sql
-- Initial schema for Kaban Plus Ultra.
-- See docs/DATA_MODEL.md for the canonical spec.

-- ──────────────────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "moddatetime";     -- updated_at triggers

-- ──────────────────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────────────────

create type role       as enum ('viewer', 'editor', 'admin');
create type visibility as enum ('private', 'link', 'shared');
create type density    as enum ('comfortable', 'compact');

-- ──────────────────────────────────────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────────────────────────────────────

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  accent_color  text not null default 'indigo',
  density       density not null default 'comfortable',
  created_at    timestamptz not null default now()
);

create table boards (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  title         text not null,
  description   text,
  cover_color   text,
  row_order     uuid[] not null default '{}'::uuid[],
  col_order     uuid[] not null default '{}'::uuid[],
  visibility    visibility not null default 'private',
  share_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table board_collaborators (
  board_id    uuid not null references boards(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        role not null,
  created_at  timestamptz not null default now(),
  primary key (board_id, profile_id)
);

create table rows (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  title       text not null,
  color       text,
  position    numeric not null,
  collapsed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  title       text not null,
  color       text,
  position    numeric not null,
  wip_limit   int,
  created_at  timestamptz not null default now()
);

-- `images` is declared before `cards` because cards references it.
create table images (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid not null references boards(id) on delete cascade,
  card_id       uuid,
  storage_path  text not null,
  width         int not null,
  height        int not null,
  mime          text not null,
  blurhash      text not null,
  uploaded_by   uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

create table cards (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid not null references boards(id) on delete cascade,
  row_id          uuid not null references rows(id) on delete cascade,
  column_id       uuid not null references columns(id) on delete cascade,
  title           text not null,
  body_md         text not null default '',
  cover_image_id  uuid references images(id) on delete set null,
  position        numeric not null,
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Defer-fill the FK from images.card_id now that cards exists.
alter table images
  add constraint images_card_id_fkey
  foreign key (card_id) references cards(id) on delete set null;

create table labels (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references boards(id) on delete cascade,
  name      text not null,
  color     text not null,
  unique (board_id, name)
);

create table card_labels (
  card_id   uuid not null references cards(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table audit_events (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  actor_id    uuid not null references profiles(id),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────────────────

create index idx_cards_board_row_col_pos  on cards (board_id, row_id, column_id, position);
create index idx_rows_board_pos           on rows (board_id, position);
create index idx_columns_board_pos        on columns (board_id, position);
create index idx_collab_profile           on board_collaborators (profile_id);
create index idx_images_board             on images (board_id);
create index idx_audit_board_created      on audit_events (board_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ──────────────────────────────────────────────────────────────────────────

create trigger trg_boards_updated_at
  before update on boards
  for each row execute procedure moddatetime(updated_at);

create trigger trg_cards_updated_at
  before update on cards
  for each row execute procedure moddatetime(updated_at);

-- ──────────────────────────────────────────────────────────────────────────
-- Authorization helper
-- ──────────────────────────────────────────────────────────────────────────

create or replace function has_board_access(b uuid, min_role text default 'viewer')
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

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — enable on every public table
-- ──────────────────────────────────────────────────────────────────────────

alter table profiles            enable row level security;
alter table boards              enable row level security;
alter table board_collaborators enable row level security;
alter table rows                enable row level security;
alter table columns             enable row level security;
alter table cards               enable row level security;
alter table labels              enable row level security;
alter table card_labels         enable row level security;
alter table images              enable row level security;
alter table audit_events        enable row level security;

-- profiles: a user can read any profile (for collaborator avatars), only write their own.
create policy profiles_read   on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- boards: owners + collaborators read; link-visibility readable when share token matches.
create policy boards_read on boards for select using (
  has_board_access(id, 'viewer')
  or (
    visibility = 'link'
    and share_token is not null
    and share_token = current_setting('request.headers', true)::jsonb->>'x-share-token'
  )
);
create policy boards_insert on boards for insert with check (owner_id = auth.uid());
create policy boards_update on boards for update using (owner_id = auth.uid() or has_board_access(id, 'admin'));
create policy boards_delete on boards for delete using (owner_id = auth.uid());

-- board_collaborators: only board owner (and admins) manage.
create policy collab_read   on board_collaborators for select using (
  profile_id = auth.uid() or has_board_access(board_id, 'viewer')
);
create policy collab_write  on board_collaborators for all
  using (has_board_access(board_id, 'admin'))
  with check (has_board_access(board_id, 'admin'));

-- rows, columns, cards, labels, card_labels, images: viewer+ reads, editor+ writes.
create policy rows_read   on rows   for select using (has_board_access(board_id, 'viewer'));
create policy rows_write  on rows   for all
  using (has_board_access(board_id, 'editor'))
  with check (has_board_access(board_id, 'editor'));

create policy columns_read  on columns for select using (has_board_access(board_id, 'viewer'));
create policy columns_write on columns for all
  using (has_board_access(board_id, 'editor'))
  with check (has_board_access(board_id, 'editor'));

create policy cards_read  on cards for select using (has_board_access(board_id, 'viewer'));
create policy cards_write on cards for all
  using (has_board_access(board_id, 'editor'))
  with check (has_board_access(board_id, 'editor'));

create policy labels_read  on labels for select using (has_board_access(board_id, 'viewer'));
create policy labels_write on labels for all
  using (has_board_access(board_id, 'editor'))
  with check (has_board_access(board_id, 'editor'));

create policy card_labels_read on card_labels for select using (
  exists (select 1 from cards c where c.id = card_id and has_board_access(c.board_id, 'viewer'))
);
create policy card_labels_write on card_labels for all
  using (exists (select 1 from cards c where c.id = card_id and has_board_access(c.board_id, 'editor')))
  with check (exists (select 1 from cards c where c.id = card_id and has_board_access(c.board_id, 'editor')));

create policy images_read  on images for select using (has_board_access(board_id, 'viewer'));
create policy images_write on images for all
  using (has_board_access(board_id, 'editor'))
  with check (has_board_access(board_id, 'editor'));

create policy audit_read on audit_events for select using (has_board_access(board_id, 'viewer'));
-- audit writes are server-only via service role; no public insert policy.

-- ──────────────────────────────────────────────────────────────────────────
-- Auto-create profile + demo board on signup
-- ──────────────────────────────────────────────────────────────────────────

create or replace function on_auth_user_created()
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
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  insert into boards (owner_id, title, description, cover_color, row_order, col_order)
  values (
    new.id,
    'Welcome to Kaban',
    'A demo board to play with. Drag a card to a new cell.',
    'indigo',
    array[row_todo, row_doing, row_done],
    array[col_now, col_next, col_later]
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

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function on_auth_user_created();
