'use server';

import { toPublicStorageUrl } from '@/lib/env';
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

export async function updateCardBody(
  boardId: string,
  cardId: string,
  bodyMd: string,
): Promise<ActionResult> {
  try {
    if (bodyMd.length > 64_000) {
      return { ok: false, error: 'Card body must be 64,000 characters or fewer.' };
    }
    const { supabase } = await authedClient();
    const { error } = await supabase.from('cards').update({ body_md: bodyMd }).eq('id', cardId);
    if (error) return { ok: false, error: error.message };
    // Body edits don't affect the board grid; skip revalidatePath to avoid an
    // unnecessary round-trip while the user is typing.
    void boardId;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function setCardCoverImage(
  boardId: string,
  cardId: string,
  imageId: string | null,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('cards')
      .update({ cover_image_id: imageId })
      .eq('id', cardId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

// ─── Labels ───────────────────────────────────────────────────────────────

export async function createLabel(
  boardId: string,
  name: string,
  color: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'Name is required.' };
    if (trimmed.length > 40) return { ok: false, error: 'Name must be 40 characters or fewer.' };
    const { supabase } = await authedClient();
    const { data, error } = await supabase
      .from('labels')
      .insert({ board_id: boardId, name: trimmed, color })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create label.' };
    bumpBoard(boardId);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function updateLabel(
  boardId: string,
  labelId: string,
  patch: { name?: string; color?: string },
): Promise<ActionResult> {
  try {
    const update: { name?: string; color?: string } = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return { ok: false, error: 'Name is required.' };
      if (trimmed.length > 40) return { ok: false, error: 'Name must be 40 characters or fewer.' };
      update.name = trimmed;
    }
    if (patch.color !== undefined) update.color = patch.color;
    const { supabase } = await authedClient();
    const { error } = await supabase.from('labels').update(update).eq('id', labelId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function deleteLabel(boardId: string, labelId: string): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('labels').delete().eq('id', labelId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function attachLabel(
  boardId: string,
  cardId: string,
  labelId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('card_labels')
      .insert({ card_id: cardId, label_id: labelId });
    if (error && !error.message.includes('duplicate')) {
      return { ok: false, error: error.message };
    }
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function detachLabel(
  boardId: string,
  cardId: string,
  labelId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('card_labels')
      .delete()
      .eq('card_id', cardId)
      .eq('label_id', labelId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

// ─── Images ───────────────────────────────────────────────────────────────

export type RecordImageInput = {
  boardId: string;
  cardId: string | null;
  storagePath: string;
  width: number;
  height: number;
  mime: string;
  blurhash: string;
};

export async function recordImage(input: RecordImageInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await authedClient();
    if (!Number.isFinite(input.width) || input.width <= 0 || input.width > 8192)
      return { ok: false, error: 'Invalid image width.' };
    if (!Number.isFinite(input.height) || input.height <= 0 || input.height > 8192)
      return { ok: false, error: 'Invalid image height.' };
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(input.mime)) return { ok: false, error: 'Image type not allowed.' };

    const { data, error } = await supabase
      .from('images')
      .insert({
        board_id: input.boardId,
        card_id: input.cardId,
        storage_path: input.storagePath,
        width: input.width,
        height: input.height,
        mime: input.mime,
        blurhash: input.blurhash,
        uploaded_by: user.id,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to record image.' };
    bumpBoard(input.boardId);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function getSignedImageUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<ActionResult<{ url: string }>> {
  try {
    const { supabase } = await authedClient();
    const { data, error } = await supabase.storage
      .from('card-images')
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to sign URL.' };
    return { ok: true, data: { url: toPublicStorageUrl(data.signedUrl) } };
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

export async function setRowColor(
  boardId: string,
  rowId: string,
  color: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('rows').update({ color }).eq('id', rowId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function setRowCollapsed(
  boardId: string,
  rowId: string,
  collapsed: boolean,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('rows').update({ collapsed }).eq('id', rowId);
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

export async function setColumnColor(
  boardId: string,
  columnId: string,
  color: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await authedClient();
    const { error } = await supabase.from('columns').update({ color }).eq('id', columnId);
    if (error) return { ok: false, error: error.message };
    bumpBoard(boardId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function setColumnWipLimit(
  boardId: string,
  columnId: string,
  wipLimit: number | null,
): Promise<ActionResult> {
  try {
    if (wipLimit !== null && (!Number.isInteger(wipLimit) || wipLimit < 1 || wipLimit > 999)) {
      return { ok: false, error: 'WIP limit must be an integer between 1 and 999.' };
    }
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('columns')
      .update({ wip_limit: wipLimit })
      .eq('id', columnId);
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
