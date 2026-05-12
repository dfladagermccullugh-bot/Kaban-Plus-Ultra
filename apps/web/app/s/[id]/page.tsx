import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { sortByPosition } from '@kpu/core';
import type { Database } from '@kpu/db';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
};

/**
 * Public read-only board view. Authenticates via the `x-share-token` header
 * which the boards / rows / columns / cards / labels / images RLS policies
 * accept (see migrations 0001 + 0005). Intentionally minimal — no realtime,
 * no drag-drop, no mutations.
 */
export default async function SharedBoardPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!t) notFound();

  const supabase = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-share-token': t } },
  });

  const [{ data: board }, { data: rows }, { data: columns }, { data: cards }] = await Promise.all([
    supabase.from('boards').select('id, title, cover_color').eq('id', id).maybeSingle(),
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

  const sortedRows = sortByPosition(rows ?? []);
  const sortedColumns = sortByPosition(columns ?? []);
  const cardsByCell = new Map<string, Array<{ id: string; title: string; position: number }>>();
  for (const c of cards ?? []) {
    const key = `${c.row_id}:${c.column_id}`;
    const arr = cardsByCell.get(key);
    if (arr) arr.push(c);
    else cardsByCell.set(key, [c]);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg-elevated/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
            aria-label="Home"
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
          </Link>
          <h1 className="truncate text-sm font-semibold">{board.title}</h1>
          <span className="inline-flex items-center gap-1 rounded-sm bg-surface px-2 py-0.5 text-[10px] font-medium text-text-muted">
            <Eye size={10} strokeWidth={1.5} aria-hidden />
            Read-only
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `12rem repeat(${sortedColumns.length}, minmax(16rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 top-0 z-20 border-b border-r border-border bg-bg-elevated" />
          {sortedColumns.map((column) => (
            <div
              key={column.id}
              className="sticky top-0 z-10 truncate border-b border-border bg-bg-elevated px-3 py-2 text-sm font-medium"
            >
              {column.title}
            </div>
          ))}
          {sortedRows.map((row) => (
            <RowSlice key={row.id} row={row} columns={sortedColumns} cardsByCell={cardsByCell} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RowSlice({
  row,
  columns,
  cardsByCell,
}: {
  row: { id: string; title: string };
  columns: Array<{ id: string }>;
  cardsByCell: Map<string, Array<{ id: string; title: string; position: number }>>;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 truncate border-b border-r border-border bg-bg-elevated px-3 py-2 text-sm font-medium">
        {row.title}
      </div>
      {columns.map((column) => {
        const cell = (cardsByCell.get(`${row.id}:${column.id}`) ?? [])
          .slice()
          .sort((a, b) => a.position - b.position);
        return (
          <div
            key={`${row.id}:${column.id}`}
            className="flex min-h-32 flex-col gap-2 border-b border-r border-border bg-bg p-2"
          >
            {cell.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-border bg-bg-elevated p-3 text-sm shadow-sm"
              >
                {c.title}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
