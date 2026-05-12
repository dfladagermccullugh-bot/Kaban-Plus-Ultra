# Data Model

Postgres 16 via Supabase. Authorization is **Row-Level Security (RLS)**. Generated TypeScript types live in `packages/db/src/types.ts`.

## Tables

```sql
-- ── auth.users is managed by Supabase. We extend with profiles. ──

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  accent_color  text not null default 'indigo',  -- one of 8 presets
  density       text not null default 'comfortable',  -- 'comfortable' | 'compact'
  created_at    timestamptz not null default now()
);

create table boards (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  title         text not null,
  description   text,
  cover_color   text,                                 -- token name, not hex
  row_order     uuid[] not null default '{}',         -- ordered ids of rows
  col_order     uuid[] not null default '{}',         -- ordered ids of columns
  visibility    text not null default 'private',      -- 'private' | 'link' | 'shared'
  share_token   text unique,                          -- non-null iff visibility='link'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table board_collaborators (
  board_id    uuid not null references boards(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null,                          -- 'viewer' | 'editor' | 'admin'
  created_at  timestamptz not null default now(),
  primary key (board_id, profile_id)
);

create table rows (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  title       text not null,
  color       text,                                   -- token name
  position    numeric not null,                       -- fractional indexing
  collapsed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  title       text not null,
  color       text,
  position    numeric not null,
  wip_limit   int,                                    -- optional, null = no limit
  created_at  timestamptz not null default now()
);

create table cards (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid not null references boards(id) on delete cascade,
  row_id          uuid not null references rows(id) on delete cascade,
  column_id       uuid not null references columns(id) on delete cascade,
  title           text not null,
  body_md         text not null default '',           -- canonical markdown
  cover_image_id  uuid references images(id) on delete set null,
  position        numeric not null,                   -- fractional indexing within cell
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table labels (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references boards(id) on delete cascade,
  name      text not null,
  color     text not null,                            -- token name
  unique (board_id, name)
);

create table card_labels (
  card_id   uuid not null references cards(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table images (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid not null references boards(id) on delete cascade,
  card_id       uuid references cards(id) on delete set null,
  storage_path  text not null,                        -- key in Supabase Storage
  width         int not null,
  height        int not null,
  mime          text not null,
  blurhash      text not null,
  uploaded_by   uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

create table audit_events (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  actor_id    uuid not null references profiles(id),
  kind        text not null,                          -- 'card.created', 'card.moved', etc.
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
```

## Indexes

```sql
create index idx_cards_board_row_col_pos on cards (board_id, row_id, column_id, position);
create index idx_rows_board_pos on rows (board_id, position);
create index idx_columns_board_pos on columns (board_id, position);
create index idx_collab_profile on board_collaborators (profile_id);
create index idx_images_board on images (board_id);
create index idx_audit_board_created on audit_events (board_id, created_at desc);
```

## Fractional indexing

For any reorder operation, compute the new `position` as the midpoint between
the two neighbors, never renumber.

```ts
// packages/core/ordering.ts
export function positionBetween(before?: number, after?: number): number {
  if (before == null && after == null) return 0;
  if (before == null) return after! - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}
```

After ~50 inserts between the same two neighbors, `position` precision degrades. The client triggers a **rebalance job** (Edge Function) when it detects gaps < 1e-9. The job rewrites positions to spaced integers in a single transaction.

## RLS policies

**Enable RLS on every table:**

```sql
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
```

### Helper functions

```sql
create or replace function has_board_access(b uuid, min_role text default 'viewer')
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from boards
    where id = b and (
      owner_id = auth.uid()
      or exists (
        select 1 from board_collaborators
        where board_id = b and profile_id = auth.uid()
          and case min_role
                when 'viewer' then role in ('viewer','editor','admin')
                when 'editor' then role in ('editor','admin')
                when 'admin'  then role in ('admin')
              end
      )
    )
  );
$$;
```

### Policy patterns

```sql
-- boards: owners and collaborators can read; only owners/admins can write.
create policy board_read on boards for select
  using ( has_board_access(id, 'viewer') or (visibility = 'link' and share_token = current_setting('request.headers.x-share-token', true)) );

create policy board_write on boards for update
  using ( owner_id = auth.uid() );

create policy board_insert on boards for insert
  with check ( owner_id = auth.uid() );

-- cards/rows/columns/labels: editor+ can write, viewer+ can read
create policy card_read   on cards for select using ( has_board_access(board_id, 'viewer') );
create policy card_write  on cards for all    using ( has_board_access(board_id, 'editor') );
-- (same shape for rows, columns, labels, card_labels, images)
```

Share-link reads use a custom HTTP header `x-share-token` checked against `boards.share_token`. Edge Functions inject this header; client SDK sends it on anonymous reads of a public board.

## Triggers

### Auto-create profile + seed demo board

```sql
create or replace function on_auth_user_created()
returns trigger language plpgsql security definer as $$
declare
  new_board_id uuid;
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into boards (owner_id, title, description, cover_color)
  values (new.id, 'Welcome to Kaban', 'A demo board to play with.', 'indigo')
  returning id into new_board_id;

  -- seed two rows, three columns, a few cards (omitted for brevity; see seed.sql)
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function on_auth_user_created();
```

### `updated_at` bumping

Standard `moddatetime` trigger on `boards.updated_at` and `cards.updated_at`.

## Realtime

Supabase Realtime is enabled on `boards`, `rows`, `columns`, `cards`, `labels`, `card_labels`, `images`. Clients subscribe per `board_id`:

```ts
supabase
  .channel(`board:${boardId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` }, handler)
  // ...for rows/columns/labels...
  .subscribe();
```

A separate **presence channel** (`presence:{boardId}`) tracks who is viewing or editing what card.

## Migrations policy

- Every schema change is a new file in `supabase/migrations/` named `NNNN_description.sql` (zero-padded sequential).
- **Never edit a merged migration.** Add a new one.
- The CI job runs `supabase db reset` against a fresh ephemeral DB to ensure migrations apply cleanly from scratch.
- Generated TypeScript types are regenerated and committed with each migration:
  ```bash
  pnpm db:types  # supabase gen types typescript --local > packages/db/src/types.ts
  ```

## Storage buckets

| Bucket | Public? | Content |
|---|---|---|
| `images` | private; signed URLs only | card inline + cover images |
| `avatars` | public read | profile avatars |
| `exports` | private; signed URLs, 1h TTL | one-off markdown export `.zip` files |

Upload validation lives in an Edge Function (`functions/upload-image`):
- max 10 MB
- mime in (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- dimensions ≤ 8192×8192
- strips EXIF
- computes blurhash
- inserts `images` row, returns signed URL
