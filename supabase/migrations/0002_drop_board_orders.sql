-- 0002_drop_board_orders.sql
-- Drops `boards.row_order` and `boards.col_order`. Canonical ordering lives in
-- `rows.position` and `columns.position` (fractional indexing from @kpu/core).
-- See docs/DECISIONS/0004-canonical-ordering.md.

-- Backfill positions for any rows/columns that may have been seeded via the
-- on_auth_user_created trigger but never had their canonical positions
-- maintained — defensive; existing data already has positions.
update rows r
   set position = sub.idx
  from (
    select id,
           row_number() over (
             partition by board_id
             order by position nulls last, created_at
           ) - 1 as idx
      from rows
  ) sub
 where r.id = sub.id
   and r.position is distinct from sub.idx
   and not exists (
     select 1 from rows r2
      where r2.board_id = r.board_id
        and r2.position is not null
        and r2.position <> 0
   );

-- Drop the arrays.
alter table boards drop column if exists row_order;
alter table boards drop column if exists col_order;

-- Update the signup trigger: stop populating the now-removed columns.
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
