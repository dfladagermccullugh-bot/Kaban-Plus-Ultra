import { LayoutGrid, Lock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SetupForm } from './setup-form';
import { setupGate } from './setup-gate.server';
import type { SetupGate } from './setup-state';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ t?: string }>;

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const { t } = await searchParams;

  let gate: SetupGate;
  try {
    gate = await setupGate(t);
  } catch {
    // Env / network blip — fall through to a generic 404 so we don't leak
    // detail about how the gate works.
    notFound();
  }

  if (!gate.ok) {
    if (gate.reason === 'already-claimed') return <AlreadyClaimed />;
    // For 'no-token', 'bad-token', and 'env' we 404 — the route should look
    // dead to anyone who doesn't have the right link.
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 self-start text-text-muted hover:text-text"
      >
        <LayoutGrid size={20} strokeWidth={1.5} className="text-accent" aria-hidden />
        <span className="text-sm font-semibold">Kaban Plus Ultra</span>
      </Link>

      <section className="mt-16 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Claim your workspace</h1>
        <p className="text-sm text-text-muted">
          This is the one-time first-run wizard. The first account you create here owns the
          workspace. Anyone else has to be invited.
        </p>
      </section>

      <SetupForm setupToken={t ?? ''} />

      <p className="mt-10 inline-flex items-start gap-2 text-xs text-text-muted">
        <Lock size={14} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Gated by the <code>SETUP_TOKEN</code> the installer printed at the end of{' '}
          <code>install-kaban.sh</code>. Burn the token after this — the page disables itself
          automatically once an owner exists.
        </span>
      </p>
    </main>
  );
}

function AlreadyClaimed() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 self-start text-text-muted hover:text-text"
      >
        <LayoutGrid size={20} strokeWidth={1.5} className="text-accent" aria-hidden />
        <span className="text-sm font-semibold">Kaban Plus Ultra</span>
      </Link>

      <section className="mt-16 flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Setup is complete</h1>
        <p className="text-sm text-text-muted">
          This workspace already has an owner. Sign in with their email to continue, or ask them for
          an invite.
        </p>
        <Link href="/sign-in" className="mt-4 text-sm text-accent hover:underline">
          Go to sign in →
        </Link>
      </section>
    </main>
  );
}
