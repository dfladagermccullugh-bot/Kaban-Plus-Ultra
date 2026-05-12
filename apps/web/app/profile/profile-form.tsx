'use client';

import { Button, Input, Label, cn } from '@kpu/ui';
import { Check } from 'lucide-react';
import { useState, useTransition } from 'react';
import { ACCENT_COLORS, type AccentColor } from './accent-colors';
import { updateProfile } from './actions';

type Props = {
  initialDisplayName: string;
  initialAccentColor: AccentColor;
  email: string;
};

type Status = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

export function ProfileForm({ initialDisplayName, initialAccentColor, email }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [accentColor, setAccentColor] = useState<AccentColor>(initialAccentColor);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.ok) setStatus({ kind: 'saved' });
      else setStatus({ kind: 'error', message: result.error });
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-text-muted">Email isn&apos;t editable yet.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          required
          maxLength={80}
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

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {status.kind === 'saved' && (
          <span className="text-sm text-success" role="status">
            Saved.
          </span>
        )}
      </div>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {status.message}
        </p>
      )}
    </form>
  );
}
