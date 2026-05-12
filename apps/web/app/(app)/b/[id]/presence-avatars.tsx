'use client';

import { createClient } from '@/lib/supabase/browser';
import { cn } from '@kpu/ui';
import { useEffect, useState } from 'react';
import {
  getLocalViewingCardId,
  publishPeers,
  subscribeToLocalViewingCard,
  unsubscribeFromLocalViewingCard,
} from './presence-bus';

export type PresenceUser = {
  id: string;
  displayName: string;
  accentColor: string;
};

type TrackedPayload = PresenceUser & {
  online_at: string;
  viewing_card_id: string | null;
};

type PresenceState = Record<string, TrackedPayload[]>;

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
 *
 * The tracked payload includes `viewing_card_id` so the card modal can render
 * an "X is editing" banner when another peer has the same card open. We
 * re-track whenever the local viewing-card changes via the presence bus.
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

    function buildPayload(): TrackedPayload {
      return {
        ...me,
        online_at: new Date().toISOString(),
        viewing_card_id: getLocalViewingCardId(),
      };
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<TrackedPayload>() as PresenceState;
        const seen = new Map<string, PresenceUser>();
        const peers: Array<{
          id: string;
          displayName: string;
          accentColor: string;
          viewingCardId: string | null;
        }> = [];
        for (const presences of Object.values(state)) {
          // Multiple tabs from the same user merge to one avatar; we take the
          // most recently online tab so `viewing_card_id` reflects the latest
          // intent.
          const latest = presences
            .slice()
            .sort((a, b) => b.online_at.localeCompare(a.online_at))[0];
          if (!latest) continue;
          if (!seen.has(latest.id)) {
            seen.set(latest.id, {
              id: latest.id,
              displayName: latest.displayName,
              accentColor: latest.accentColor,
            });
            peers.push({
              id: latest.id,
              displayName: latest.displayName,
              accentColor: latest.accentColor,
              viewingCardId: latest.viewing_card_id ?? null,
            });
          }
        }
        if (!seen.has(me.id)) {
          seen.set(me.id, me);
          peers.push({ ...me, viewingCardId: getLocalViewingCardId() });
        }
        setUsers(Array.from(seen.values()));
        publishPeers(peers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(buildPayload());
        }
      });

    // Re-ship presence whenever the local card-viewing state changes.
    const onLocalChange = () => {
      void channel.track(buildPayload());
    };
    subscribeToLocalViewingCard(onLocalChange);

    return () => {
      unsubscribeFromLocalViewingCard(onLocalChange);
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
