'use client';

import { ACCENT_COLORS, type AccentColor } from '@/app/profile/accent-colors';
import { Button, Input, Label, cn } from '@kpu/ui';
import { Check, ExternalLink } from 'lucide-react';
import { useState, useTransition } from 'react';
import { type ClaimResult, claimWorkspace } from './actions';

type Status =
  | { kind: 'idle' }
  | { kind: 'success'; email: string; magicLink: string | null }
  | { kind: 'error'; message: string };

export function SetupForm({ setupToken }: { setupToken: string }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accentColor, setAccentColor] = useState<AccentColor>('indigo');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set('setup_token', setupToken);
    startTransition(async () => {
      const result: ClaimResult = await claimWorkspace(formData);
      if (result.ok) {
        setStatus({ kind: 'success', email: result.email, magicLink: result.magicLink });
      } else {
        setStatus({ kind: 'error', message: result.error });
      }
    });
  }

  if (status.kind === 'success') {
    return (
      <div className="mt-8 flex flex-col gap-4 rounded-md bg-surface p-5">
        <div className="flex items-center gap-2">
          <Check size={20} strokeWidth={1.5} className="text-success" aria-hidden />
          <p className="text-sm font-medium">Owner account created.</p>
        </div>
        <p className="text-sm text-text-muted">
          We made <span className="text-text">{status.email}</span> the workspace owner.
        </p>
        {status.magicLink ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">
              SMTP may not be wired up yet — use this one-time sign-in link:
            </p>
            <a
              href={status.magicLink}
              className="inline-flex items-center gap-2 break-all rounded-sm bg-bg px-3 py-2 text-sm text-accent hover:underline"
            >
              <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
              <span>Sign in now</span>
            </a>
            <p className="text-xs text-text-muted">
              The link expires in an hour and works once. Bookmark <code>/sign-in</code> for next
              time.
            </p>
          </div>
        ) : (
          <a href="/sign-in" className="text-sm text-accent hover:underline">
            Go to sign in →
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={onSubmit} className="mt-8 flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          inputMode="email"
          placeholder="owner@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-text-muted">
          Used for magic-link sign-in. Becomes the workspace owner.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          required
          maxLength={80}
          placeholder="Avery Operator"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={pending}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-text">Accent color</legend>
        <input type="hidden" name="accent_color" value={accentColor} />
        <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map(({ name, swatch }) => {
            const isActive = name === accentColor;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={name}
                onClick={() => setAccentColor(name)}
                disabled={pending}
                className={cn(
                  'inline-flex h-11 w-11 items-center justify-center rounded-sm transition-shadow',
                  swatch,
                  isActive
                    ? 'ring-2 ring-text/30 shadow-md'
                    : 'ring-1 ring-transparent hover:ring-text/10',
                )}
              >
                {isActive && <Check size={16} strokeWidth={2} className="text-white" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="avatar">Avatar (optional)</Label>
        <Input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
        />
        <p className="text-xs text-text-muted">PNG, JPEG, or WebP. 2 MB max.</p>
      </div>

      <Button type="submit" disabled={pending || !email || !displayName}>
        {pending ? 'Claiming…' : 'Claim workspace'}
      </Button>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {status.message}
        </p>
      )}
    </form>
  );
}
