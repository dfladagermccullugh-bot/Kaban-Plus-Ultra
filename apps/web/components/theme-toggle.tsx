'use client';

import { cn } from '@kpu/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? (theme ?? 'system') : 'system';

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-sm bg-surface p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors',
              isActive ? 'bg-bg-elevated text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
