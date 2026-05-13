'use server';

import { createClient } from '@/lib/supabase/server';
import { type ImportEntry, parseImportedBoard } from '@kpu/core';
import { revalidatePath } from 'next/cache';

export type ImportResult =
  | { ok: true; boardId: string; counts: { rows: number; columns: number; cards: number } }
  | { ok: false; error: string };

const MAX_ZIP_BYTES = 20 * 1024 * 1024;

/**
 * Drag-drop import: take a `.zip` produced by `/b/[id]/export` (or any
 * archive that mirrors its layout) and create a brand-new board owned
 * by the signed-in user. Returns the new board id so the client can
 * navigate to it.
 *
 * RLS gates every write; we use the authed client end-to-end. Service-
 * role is never used here.
 */
export async function importBoardFromZip(formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) return { ok: false, error: 'No file uploaded.' };
    if (file.size === 0) return { ok: false, error: 'File is empty.' };
    if (file.size > MAX_ZIP_BYTES) {
      return { ok: false, error: 'Archive exceeds the 20 MB import limit.' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in.' };

    const entries = await unzipToEntries(file);
    const parsed = parseImportedBoard(entries);
    if (parsed.rows.length === 0 || parsed.columns.length === 0) {
      return { ok: false, error: 'Archive has no rows or columns to import.' };
    }

    const { data: board, error: boardErr } = await supabase
      .from('boards')
      .insert({ title: parsed.title, owner_id: user.id, cover_color: 'indigo' })
      .select('id')
      .single();
    if (boardErr || !board) {
      return { ok: false, error: boardErr?.message ?? 'Failed to create board.' };
    }
    const boardId = board.id;

    const rowIdByTitle = new Map<string, string>();
    for (const [i, title] of parsed.rows.entries()) {
      const { data, error } = await supabase
        .from('rows')
        .insert({ board_id: boardId, title, color: 'slate', position: i })
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create row.' };
      rowIdByTitle.set(title, data.id);
    }

    const columnIdByTitle = new Map<string, string>();
    for (const [i, title] of parsed.columns.entries()) {
      const { data, error } = await supabase
        .from('columns')
        .insert({ board_id: boardId, title, color: 'indigo', position: i })
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create column.' };
      columnIdByTitle.set(title, data.id);
    }

    const labelIdByName = new Map<string, string>();
    for (const name of parsed.labels) {
      const { data, error } = await supabase
        .from('labels')
        .insert({ board_id: boardId, name, color: 'slate' })
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create label.' };
      labelIdByName.set(name, data.id);
    }

    let cardCount = 0;
    // Position per (row, column) cell — sequential integers preserve
    // the archive's order. We zero-fill positions per cell so cards
    // never end up overlapping.
    const positionPerCell = new Map<string, number>();
    for (const card of parsed.cards) {
      const rowId = rowIdByTitle.get(card.rowTitle);
      const columnId = columnIdByTitle.get(card.columnTitle);
      if (!rowId || !columnId) continue;
      const cellKey = `${rowId}:${columnId}`;
      const position = positionPerCell.get(cellKey) ?? 0;
      positionPerCell.set(cellKey, position + 1);

      const { data: created, error: cardErr } = await supabase
        .from('cards')
        .insert({
          board_id: boardId,
          row_id: rowId,
          column_id: columnId,
          title: card.title,
          body_md: card.bodyMd,
          position,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (cardErr || !created) {
        return { ok: false, error: cardErr?.message ?? 'Failed to create card.' };
      }

      if (card.labels.length > 0) {
        const links = card.labels
          .map((name) => labelIdByName.get(name))
          .filter((id): id is string => Boolean(id))
          .map((labelId) => ({ card_id: created.id, label_id: labelId }));
        if (links.length > 0) {
          const { error: linkErr } = await supabase.from('card_labels').insert(links);
          if (linkErr) return { ok: false, error: linkErr.message };
        }
      }
      cardCount += 1;
    }

    revalidatePath('/boards');
    revalidatePath(`/b/${boardId}`);
    return {
      ok: true,
      boardId,
      counts: { rows: parsed.rows.length, columns: parsed.columns.length, cards: cardCount },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

async function unzipToEntries(file: File): Promise<ImportEntry[]> {
  const { default: JSZip } = await import('jszip');
  const buffer = new Uint8Array(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const entries: ImportEntry[] = [];
  const paths = Object.keys(zip.files);
  for (const path of paths) {
    const entry = zip.files[path];
    if (!entry || entry.dir) continue;
    entries.push({ path, content: await entry.async('string') });
  }
  return entries;
}
