import { getCurrentUser } from '@/lib/auth';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type AccentColor, isAccentColor } from './accent-colors';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/profile');

  const initialDisplayName = user.displayName ?? user.email.split('@')[0] ?? '';
  const initialAccent: AccentColor = isAccentColor(user.accentColor ?? '')
    ? (user.accentColor as AccentColor)
    : 'indigo';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <Link
        href="/boards"
        className="inline-flex items-center gap-2 self-start text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
        Back to boards
      </Link>

      <section className="mt-8 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-text-muted">Tune the basics. Email and avatar come later.</p>
      </section>

      <div className="mt-8">
        <ProfileForm
          initialDisplayName={initialDisplayName}
          initialAccentColor={initialAccent}
          email={user.email}
        />
      </div>

      <form action="/sign-out" method="post" className="mt-12">
        <button
          type="submit"
          className="inline-flex h-11 items-center text-sm text-text-muted hover:text-danger"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
