'use server';

import { createClient } from '@/lib/supabase/server';
import { positionBetween } from '@kpu/core';
import { revalidatePath } from 'next/cache';

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function authedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return { supabase, user };
}

function bumpBoard(boardId: string) {
  revalidatePath(`/b/${boardId}`);
  revalidatePath('/boards');
}

// ─── Cards ────────────────────────────────────────────────────────────────

export type CreateCardInput = {
  boardId: string;
  rowId: string;
  columnId: string;
  title: string;
};

export async function createCard(input: CreateCardInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await authedClient();
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };
    if (title.length > 200) return { ok: false, error: 'Title must be 200 characters or fewer.' };

    const { data: last } = await supabase
      .from('cards')
      .select('position')
      .eq('board_id', input.boardId)
      .eq('row_id', input.rowId)
      .eq('column_id', input.columnId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = positionBetween(last?.position ?? null, null);

    const { data, error } = await supabase
      .from('cards')
      .insert({
        board_id: input.boardId,
        row_id: input.rowId,
        column_id: input.columnId,
        title,
        position,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create card.' };

    bumpBoard(input.boardId);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export type MoveCardInput = {
  boardId: string;
  cardId: string;
  rowId: string;
  columnId: string;
  position: number;
};

export async function moveCard(input: MoveCardInput): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('cards')
      .update({
        row_id: input.rowId,
        column_id: input.columnId,
        position: input.position,
      })
      .eq('id', input.cardId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(input.boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function renameCard(
  boardId: string,
  cardId: string,
  title: string,
): Promise<ActionResult> {
  try {
    const next = title.trim();
    if (!next) return { ok: false, error: 'Title is required.' };
    if (next.length > 200) return { ok: false, error: 'Title must be 200 characters or fewer.' };
    const { supabase } = await authedClient();
    const { error } = await supabase.from('cards').update({ title: next }).eq('id', cardId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function deleteCard(boardId: string, cardId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

// ─── Rows ─────────────────────────────────────────────────────────────────

export async function createRow(
  boardId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const next = title.trim();
    if (!next) return { ok: false, error: 'Title is required.' };
    if (next.length > 80) return { ok: false, error: 'Title must be 80 characters or fewer.' };
    const { supabase } = await authedClient();

    const { data: last } = await supabase
      .from('rows')
      .select('position')
      .eq('board_id', boardId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = positionBetween(last?.position ?? null, null);
    const { data, error } = await supabase
      .from('rows')
      .insert({ board_id: boardId, title: next, color: 'slate', position })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create row.' };
    bumpBoard(boardId);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function renameRow(
  boardId: string,
  rowId: string,
  title: string,
): Promise<ActionResult> {
  try {
    const next = title.trim();
    if (!next) return { ok: false, error: 'Title is required.' };
    if (next.length > 80) return { ok: false, error: 'Title must be 80 characters or fewer.' };
    const { supabase } = await authedClient();
    const { error } = await supabase.from('rows').update({ title: next }).eq('id', rowId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function moveRow(
  boardId: string,
  rowId: string,
  position: number,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('rows').update({ position }).eq('id', rowId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function deleteRow(boardId: string, rowId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('rows').delete().eq('id', rowId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

// ─── Columns ──────────────────────────────────────────────────────────────

export async function createColumn(
  boardId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const next = title.trim();
    if (!next) return { ok: false, error: 'Title is required.' };
    if (next.length > 80) return { ok: false, error: 'Title must be 80 characters or fewer.' };
    const { supabase } = await authedClient();

    const { data: last } = await supabase
      .from('columns')
      .select('position')
      .eq('board_id', boardId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = positionBetween(last?.position ?? null, null);
    const { data, error } = await supabase
      .from('columns')
      .insert({ board_id: boardId, title: next, color: 'indigo', position })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create column.' };
    bumpBoard(boardId);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function renameColumn(
  boardId: string,
  columnId: string,
  title: string,
): Promise<ActionResult> {
  try {
    const next = title.trim();
    if (!next) return { ok: false, error: 'Title is required.' };
    if (next.length > 80) return { ok: false, error: 'Title must be 80 characters or fewer.' };
    const { supabase } = await authedClient();
    const { error } = await supabase.from('columns').update({ title: next }).eq('id', columnId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function moveColumn(
  boardId: string,
  columnId: string,
  position: number,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('columns').update({ position }).eq('id', columnId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function deleteColumn(boardId: string, columnId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('columns').delete().eq('id', columnId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}
