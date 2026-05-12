import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LayoutGrid, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BoardCard } from './board-card';
import { NewBoardForm } from './new-board-form';

export const dynamic = 'force-dynamic';

export default async function BoardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/boards');

  const name = user.displayName ?? user.email.split('@')[0] ?? 'there';

  const supabase = await createClient();
  const { data: boards } = await supabase
    .from('boards')
    .select('id, title, cover_color, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid size={20} strokeWidth={1.5} className="text-accent" aria-hidden />
          <span className="text-sm font-semibold">Kaban Plus Ultra</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/profile"
            className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <UserCircle size={16} strokeWidth={1.5} aria-hidden />
            {name}
          </Link>
        </div>
      </header>

      <section className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Your boards</h1>
          <p className="text-sm text-text-muted">
            {boards?.length
              ? `${boards.length} board${boards.length === 1 ? '' : 's'}`
              : 'Start a new board to begin.'}
          </p>
        </div>
        <NewBoardForm />
      </section>

      <section className="mt-8">
        {boards && boards.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id}>
                <BoardCard
                  id={b.id}
                  title={b.title}
                  coverColor={b.cover_color}
                  updatedAt={b.updated_at}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border p-12 text-center">
            <p className="text-sm text-text-muted">No boards yet. Create your first one above.</p>
          </div>
        )}
      </section>
    </main>
  );
}
