'use client';

import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type PresencePeer, subscribeToPresence, unsubscribeFromPresence } from './presence-bus';

type Props = {
  cardId: string;
  selfId: string | null;
};

/**
 * Shows a small banner inside the card modal when at least one other
 * presence-tracked user has this same card open. Hidden when you're the only
 * one viewing it.
 */
export function PeerEditingBanner({ cardId, selfId }: Props) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);

  useEffect(() => {
    function handle(next: PresencePeer[]) {
      setPeers(
        next.filter((p) => p.viewingCardId === cardId && (selfId === null || p.id !== selfId)),
      );
    }
    subscribeToPresence(handle);
    return () => unsubscribeFromPresence(handle);
  }, [cardId, selfId]);

  if (peers.length === 0) return null;

  const names =
    peers.length === 1
      ? peers[0]?.displayName
      : peers.length === 2
        ? `${peers[0]?.displayName} and ${peers[1]?.displayName}`
        : `${peers[0]?.displayName} and ${peers.length - 1} others`;

  return (
    <p className="flex items-center gap-2 rounded-sm bg-accent/10 px-3 py-2 text-xs text-accent">
      <Eye size={14} strokeWidth={1.5} aria-hidden />
      {names} {peers.length === 1 ? 'is' : 'are'} also viewing this card.
    </p>
  );
}
