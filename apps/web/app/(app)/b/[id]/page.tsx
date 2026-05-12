import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { sortByPosition } from '@kpu/core';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardView } from './board-view';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function BoardPage({ params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/b/${id}`);

  const supabase = await createClient();
  const [{ data: board }, { data: rows }, { data: columns }, { data: cards }] = await Promise.all([
    supabase.from('boards').select('id, title, cover_color, owner_id').eq('id', id).maybeSingle(),
    supabase
      .from('rows')
      .select('id, board_id, title, color, position, collapsed')
      .eq('board_id', id),
    supabase
      .from('columns')
      .select('id, board_id, title, color, position, wip_limit')
      .eq('board_id', id),
    supabase
      .from('cards')
      .select('id, board_id, row_id, column_id, title, position')
      .eq('board_id', id),
  ]);

  if (!board) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg-elevated/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/boards"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
            aria-label="Back to boards"
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
          </Link>
          <h1 className="truncate text-sm font-semibold">{board.title}</h1>
        </div>
        <ThemeToggle />
      </header>

      <BoardView
        boardId={board.id}
        initialRows={sortByPosition(rows ?? [])}
        initialColumns={sortByPosition(columns ?? [])}
        initialCards={cards ?? []}
      />
    </div>
  );
}
