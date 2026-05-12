import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { LayoutGrid, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function BoardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/boards');

  const name = user.displayName ?? user.email.split('@')[0] ?? 'there';

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
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

      <section className="mt-16 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Phase 1 — Auth complete
        </p>
        <h1 className="text-3xl font-semibold">Hi, {name}.</h1>
        <p className="max-w-xl text-text-muted">
          Boards land in Phase 2: a true 2D grid of rows × columns with markdown cards.
        </p>
      </section>
    </main>
  );
}
