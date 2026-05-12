'use client';

import { createClient } from '@/lib/supabase/browser';
import { cn } from '@kpu/ui';
import { useEffect, useState } from 'react';

export type PresenceUser = {
  id: string;
  displayName: string;
  accentColor: string;
};

type PresenceState = Record<string, Array<PresenceUser & { online_at: string }>>;

type Props = {
  boardId: string;
  me: PresenceUser;
};

const ACCENT_BG: Record<string, string> = {
  indigo: 'bg-[oklch(60%_0.18_264)]',
  blue: 'bg-[oklch(62%_0.17_240)]',
  teal: 'bg-[oklch(66%_0.14_190)]',
  green: 'bg-[oklch(65%_0.16_145)]',
  lime: 'bg-[oklch(76%_0.18_125)]',
  amber: 'bg-[oklch(75%_0.15_75)]',
  rose: 'bg-[oklch(64%_0.22_15)]',
  violet: 'bg-[oklch(60%_0.22_300)]',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? '?';
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

/**
 * Compact stack of avatars for every collaborator currently connected to this
 * board's presence channel. The current user is included so the count matches
 * what other clients see; we render them with a thinner ring so the user can
 * still pick themselves out.
 */
export function PresenceAvatars({ boardId, me }: Props) {
  const [users, setUsers] = useState<PresenceUser[]>([me]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase.channel(`presence:${boardId}`, {
      config: { presence: { key: me.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<
          PresenceUser & { online_at: string }
        >() as PresenceState;
        const seen = new Map<string, PresenceUser>();
        for (const presences of Object.values(state)) {
          for (const p of presences) {
            if (!seen.has(p.id)) {
              seen.set(p.id, { id: p.id, displayName: p.displayName, accentColor: p.accentColor });
            }
          }
        }
        // Always include self even if our own track event hasn't landed yet.
        if (!seen.has(me.id)) seen.set(me.id, me);
        setUsers(Array.from(seen.values()));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...me, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, me]);

  const visible = users.slice(0, 5);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u) => (
        <span
          key={u.id}
          title={u.displayName}
          aria-label={u.displayName}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-bg-elevated',
            ACCENT_BG[u.accentColor] ?? 'bg-[oklch(60%_0.18_264)]',
            u.id === me.id && 'ring-1 ring-accent',
          )}
        >
          {initials(u.displayName)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          aria-label={`${overflow} more`}
          title={`${overflow} more`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[10px] font-semibold text-text-muted ring-2 ring-bg-elevated"
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
