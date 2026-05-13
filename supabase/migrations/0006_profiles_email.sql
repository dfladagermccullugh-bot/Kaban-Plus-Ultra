-- 0006_profiles_email.sql
-- Pin the user's email on `profiles` so invite-by-email can do a directory
-- lookup without paginating `auth.admin.listUsers`.

alter table profiles add column if not exists email text;

-- Backfill from auth.users for any pre-existing profile rows.
update profiles p
   set email = lower(u.email)
  from auth.users u
 where u.id = p.id
   and p.email is null
   and u.email is not null;

-- Lowercase, unique. Skip nulls so the migration is safe even before backfill
-- completes (auth.users.email is nullable for some provider-only signups).
create unique index if not exists idx_profiles_email_unique
  on profiles (email)
  where email is not null;

-- Update the signup trigger to populate the column going forward. The body is
-- identical to the original except for the extra `email` insert column.
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

-- Keep `profiles.email` in sync if the user changes their email through
-- Supabase Auth (e.g. via a verification flow). Service-role-equivalent
-- trigger; runs on every auth.users update.
create or replace function on_auth_user_email_updated()
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

drop trigger if exists trg_auth_user_email_updated on auth.users;
create trigger trg_auth_user_email_updated
  after update of email on auth.users
  for each row execute function on_auth_user_email_updated();
