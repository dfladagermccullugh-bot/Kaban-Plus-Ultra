import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@kpu/ui';
import { Github, LayoutGrid } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid size={20} strokeWidth={1.5} className="text-accent" aria-hidden />
          <span className="text-sm font-semibold">Kaban Plus Ultra</span>
        </div>
        <ThemeToggle />
      </header>

      <section className="mt-24 flex flex-col items-start gap-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Phase 0 — Scaffolding
        </p>
        <h1 className="max-w-2xl text-balance text-3xl font-semibold leading-tight sm:text-4xl">
          Trello at home, with real swimlanes.
        </h1>
        <p className="max-w-xl text-text-muted">
          Every board is a true 2D grid: rows and columns, not separator-card hacks. Cards are
          markdown with image support. Sharing is friction-free. One codebase for web, iOS, and
          Android.
        </p>
        <div className="flex items-center gap-3">
          <Button disabled>Coming soon</Button>
          <a
            href="https://github.com/dfladagermccullugh-bot/Kaban-Plus-Ultra"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium text-text-muted hover:text-text"
          >
            <Github size={16} strokeWidth={1.5} aria-hidden />
            <span>Source</span>
          </a>
        </div>
      </section>

      <footer className="mt-auto pt-16 text-xs text-text-muted">
        v0.0.0 · See <code className="font-mono">docs/ROADMAP.md</code>
      </footer>
    </main>
  );
}
