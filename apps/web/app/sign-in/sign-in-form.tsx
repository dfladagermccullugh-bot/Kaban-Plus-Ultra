'use client';

import { getSiteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/browser';
import { Button, Input, Label } from '@kpu/ui';
import { CheckCircle2, Mail } from 'lucide-react';
import { type FormEvent, useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'sending' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      setStatus({ kind: 'sent' });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      });
    }
  }

  async function signInWithGoogle() {
    setStatus({ kind: 'sending' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      // Redirect happens via Supabase.
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="mt-8 flex flex-col items-start gap-3 rounded-md bg-surface p-4">
        <CheckCircle2 size={20} strokeWidth={1.5} className="text-success" aria-hidden />
        <div>
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="text-sm text-text-muted">
            We sent a link to <span className="text-text">{email}</span>. The link works once and
            expires in an hour.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatus({ kind: 'idle' })}
          className="text-xs text-text-muted hover:text-text"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={sendMagicLink} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status.kind === 'sending'}
        />
      </div>

      <Button type="submit" disabled={status.kind === 'sending' || !email}>
        <Mail size={16} strokeWidth={1.5} aria-hidden />
        {status.kind === 'sending' ? 'Sending…' : 'Email me a magic link'}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={signInWithGoogle}
        disabled={status.kind === 'sending'}
      >
        Continue with Google
      </Button>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {status.message}
        </p>
      )}
    </form>
  );
}
