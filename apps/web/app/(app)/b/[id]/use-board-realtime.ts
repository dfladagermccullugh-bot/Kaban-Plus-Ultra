'use client';

import { createClient } from '@/lib/supabase/browser';
import type {
  RealtimePostgresChangesPayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import type {
  CardLabelLink,
  CardModel,
  ColumnModel,
  ImageModel,
  LabelModel,
  RowModel,
} from './types';

type RowChange = RealtimePostgresChangesPayload<{ [k: string]: unknown }>;

type Setters = {
  setCards: React.Dispatch<React.SetStateAction<CardModel[]>>;
  setRows: React.Dispatch<React.SetStateAction<RowModel[]>>;
  setColumns: React.Dispatch<React.SetStateAction<ColumnModel[]>>;
  setLabels: React.Dispatch<React.SetStateAction<LabelModel[]>>;
  setCardLabels: React.Dispatch<React.SetStateAction<CardLabelLink[]>>;
  setImages: React.Dispatch<React.SetStateAction<ImageModel[]>>;
};

type Options = Setters & {
  boardId: string;
  /** When this returns true, incoming UPDATE events for the matching card are
   *  ignored so a remote echo can't yank a card out of the user's drag. */
  isCardLocked: (cardId: string) => boolean;
};

/**
 * Per-board Realtime subscription.
 *
 * Listens to postgres_changes for every table BoardView holds in state and
 * merges them into the optimistic client state. We never replace a card's
 * row/column/position if `isCardLocked(cardId)` is true — that prevents a
 * remote echo of our own optimistic move from clobbering a drag in flight.
 *
 * card_labels can't be filtered by `board_id` server-side (the column lives on
 * `cards`), so we receive all card_label changes the user can read (RLS gates
 * that to boards they have access to) and rely on the merge being idempotent.
 */
export function useBoardRealtime({
  boardId,
  setCards,
  setRows,
  setColumns,
  setLabels,
  setCardLabels,
  setImages,
  isCardLocked,
}: Options) {
  const lockedRef = useRef(isCardLocked);
  lockedRef.current = isCardLocked;

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      // Env not configured locally — silently skip.
      return;
    }

    const filter = `board_id=eq.${boardId}`;
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter },
        (payload: RowChange) => applyCardChange(payload, setCards, lockedRef.current),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rows', filter },
        (payload: RowChange) => applyRowOrColumnChange(payload, setRows),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter },
        (payload: RowChange) => applyRowOrColumnChange(payload, setColumns),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'labels', filter },
        (payload: RowChange) => applyLabelChange(payload, setLabels),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'images', filter },
        (payload: RowChange) => applyImageChange(payload, setImages),
      )
      .on(
        // card_labels has no board_id column — RLS narrows reads to boards the
        // user can access, and we merge by (card_id, label_id) which is the PK.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card_labels' },
        (payload: RowChange) => applyCardLabelChange(payload, setCardLabels),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, setCards, setRows, setColumns, setLabels, setCardLabels, setImages]);
}

function toCard(row: Record<string, unknown>): CardModel | null {
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    board_id: row.board_id as string,
    row_id: row.row_id as string,
    column_id: row.column_id as string,
    title: row.title as string,
    position: row.position as number,
    cover_image_id: (row.cover_image_id as string | null) ?? null,
  };
}

function applyCardChange(
  payload: RowChange,
  setCards: Setters['setCards'],
  isCardLocked: (cardId: string) => boolean,
) {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: string }).id;
    if (!id) return;
    setCards((prev) => prev.filter((c) => c.id !== id));
    return;
  }
  const card = toCard(payload.new as Record<string, unknown>);
  if (!card) return;
  if (payload.eventType === 'INSERT') {
    setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
    return;
  }
  // UPDATE
  setCards((prev) => {
    const existing = prev.find((c) => c.id === card.id);
    if (!existing) return [...prev, card];
    if (isCardLocked(card.id)) {
      // Preserve the client-controlled positional fields, accept the rest.
      return prev.map((c) =>
        c.id === card.id
          ? {
              ...card,
              row_id: existing.row_id,
              column_id: existing.column_id,
              position: existing.position,
            }
          : c,
      );
    }
    return prev.map((c) => (c.id === card.id ? card : c));
  });
}

function applyRowOrColumnChange<T extends { id: string }>(
  payload: RowChange,
  setState: React.Dispatch<React.SetStateAction<T[]>>,
) {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: string }).id;
    if (!id) return;
    setState((prev) => prev.filter((item) => item.id !== id));
    return;
  }
  const next = payload.new as T;
  if (!next || typeof next.id !== 'string') return;
  setState((prev) => {
    if (payload.eventType === 'INSERT') {
      return prev.some((i) => i.id === next.id) ? prev : [...prev, next];
    }
    return prev.some((i) => i.id === next.id)
      ? prev.map((i) => (i.id === next.id ? next : i))
      : [...prev, next];
  });
}

function applyLabelChange(payload: RowChange, setLabels: Setters['setLabels']) {
  applyRowOrColumnChange<LabelModel>(payload, setLabels);
}

function applyImageChange(payload: RowChange, setImages: Setters['setImages']) {
  applyRowOrColumnChange<ImageModel>(payload, setImages);
}

function applyCardLabelChange(payload: RowChange, setCardLabels: Setters['setCardLabels']) {
  if (payload.eventType === 'DELETE') {
    const old = (payload as RealtimePostgresDeletePayload<Record<string, unknown>>).old as {
      card_id?: string;
      label_id?: string;
    };
    if (!old.card_id || !old.label_id) return;
    setCardLabels((prev) =>
      prev.filter((l) => !(l.card_id === old.card_id && l.label_id === old.label_id)),
    );
    return;
  }
  const next = payload.new as { card_id?: string; label_id?: string };
  if (!next.card_id || !next.label_id) return;
  const link: CardLabelLink = { card_id: next.card_id, label_id: next.label_id };
  setCardLabels((prev) =>
    prev.some((l) => l.card_id === link.card_id && l.label_id === link.label_id)
      ? prev
      : [...prev, link],
  );
}
