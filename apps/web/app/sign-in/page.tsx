import { createClient } from '@/lib/supabase/server';
import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from './sign-in-form';

type SearchParams = Promise<{ next?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  // If already signed in, skip the form.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(next?.startsWith('/') ? next : '/boards');
  } catch {
    // Env not configured locally — fall through to the form so the page still renders.
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
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-text-muted">No password. We&apos;ll email you a magic link.</p>
      </section>

      <SignInForm next={next ?? '/boards'} />

      <p className="mt-10 text-xs text-text-muted">
        By continuing you agree to use this app for personal planning. Your data stays yours.
      </p>
    </main>
  );
}
