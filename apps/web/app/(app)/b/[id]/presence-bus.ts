'use client';

/**
 * Tiny client-side pub/sub that wires the two halves of presence together:
 *
 *  - `<PresenceAvatars>` owns the Supabase Realtime presence channel. When it
 *    receives a `sync` event it publishes the merged peer list here, and it
 *    listens for local-viewing-card changes so it can re-`track()` the new
 *    payload.
 *
 *  - `<CardEditorModal>` reports its open/close lifecycle here (so the avatar
 *    component can ship `viewing_card_id` over the wire) and subscribes to
 *    peer changes so it can render the "X is editing" banner.
 *
 * Both components live in different React subtrees (the modal is in a
 * parallel route slot) so we can't pass props between them. A module-level
 * singleton is simpler than threading a context through the layout.
 */

export type PresencePeer = {
  id: string;
  displayName: string;
  accentColor: string;
  viewingCardId: string | null;
};

export type PresenceListener = (peers: PresencePeer[]) => void;
type LocalCardListener = (cardId: string | null) => void;

let peers: PresencePeer[] = [];
let localViewingCardId: string | null = null;
const peerListeners = new Set<PresenceListener>();
const localCardListeners = new Set<LocalCardListener>();

export function publishPeers(next: PresencePeer[]): void {
  peers = next;
  for (const fn of peerListeners) fn(peers);
}

export function subscribeToPresence(listener: PresenceListener): void {
  peerListeners.add(listener);
  // Hand the current state immediately so the subscriber doesn't wait for the
  // next channel sync to render correctly.
  listener(peers);
}

export function unsubscribeFromPresence(listener: PresenceListener): void {
  peerListeners.delete(listener);
}

export function getLocalViewingCardId(): string | null {
  return localViewingCardId;
}

export function setLocalViewingCardId(next: string | null): void {
  if (localViewingCardId === next) return;
  localViewingCardId = next;
  for (const fn of localCardListeners) fn(next);
}

export function subscribeToLocalViewingCard(listener: LocalCardListener): void {
  localCardListeners.add(listener);
}

export function unsubscribeFromLocalViewingCard(listener: LocalCardListener): void {
  localCardListeners.delete(listener);
}
