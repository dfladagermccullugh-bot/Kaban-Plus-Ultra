'use server';

import { createClient } from '@/lib/supabase/server';
import { type ImportEntry, parseImportedBoard, positionForAppend } from '@kpu/core';
import { revalidatePath } from 'next/cache';

export type MergeResult =
  | {
      ok: true;
      counts: {
        rowsCreated: number;
        columnsCreated: number;
        labelsCreated: number;
        cardsCreated: number;
      };
    }
  | { ok: false; error: string };

const MAX_ZIP_BYTES = 20 * 1024 * 1024;

/**
 * Merge a `.zip` (produced by `/b/[id]/export`) into an existing board.
 * Rows / columns / labels are matched against the destination board
 * by case-insensitive title; missing ones are created and appended at
 * the end. Cards are always created (we never overwrite an existing
 * card — the safe default is append).
 */
export async function mergeBoardFromZip(boardId: string, formData: FormData): Promise<MergeResult> {
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

    // RLS will deny the writes if the user lacks editor+ — fetch first
    // to surface a friendlier error than the bare PostgREST one.
    const { data: board, error: boardErr } = await supabase
      .from('boards')
      .select('id')
      .eq('id', boardId)
      .maybeSingle();
    if (boardErr || !board) return { ok: false, error: 'Board not found or no access.' };

    const entries = await unzipToEntries(file);
    const parsed = parseImportedBoard(entries);

    const [{ data: existingRows }, { data: existingColumns }, { data: existingLabels }] =
      await Promise.all([
        supabase.from('rows').select('id, title, position').eq('board_id', boardId),
        supabase.from('columns').select('id, title, position').eq('board_id', boardId),
        supabase.from('labels').select('id, name').eq('board_id', boardId),
      ]);

    const norm = (s: string) => s.trim().toLowerCase();
    const rowIdByTitle = new Map<string, string>();
    for (const r of existingRows ?? []) rowIdByTitle.set(norm(r.title), r.id);
    const columnIdByTitle = new Map<string, string>();
    for (const c of existingColumns ?? []) columnIdByTitle.set(norm(c.title), c.id);
    const labelIdByName = new Map<string, string>();
    for (const l of existingLabels ?? []) labelIdByName.set(norm(l.name), l.id);

    let rowAppendPos = positionForAppend(existingRows ?? []);
    let rowsCreated = 0;
    for (const title of parsed.rows) {
      if (rowIdByTitle.has(norm(title))) continue;
      const { data, error } = await supabase
        .from('rows')
        .insert({ board_id: boardId, title, color: 'slate', position: rowAppendPos })
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create row.' };
      rowIdByTitle.set(norm(title), data.id);
      rowAppendPos += 1;
      rowsCreated += 1;
    }

    let columnAppendPos = positionForAppend(existingColumns ?? []);
    let columnsCreated = 0;
    for (const title of parsed.columns) {
      if (columnIdByTitle.has(norm(title))) continue;
      const { data, error } = await supabase
        .from('columns')
        .insert({ board_id: boardId, title, color: 'indigo', position: columnAppendPos })
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create column.' };
      columnIdByTitle.set(norm(title), data.id);
      columnAppendPos += 1;
      columnsCreated += 1;
    }

    let labelsCreated = 0;
    for (const name of parsed.labels) {
      if (labelIdByName.has(norm(name))) continue;
      const { data, error } = await supabase
        .from('labels')
        .insert({ board_id: boardId, name, color: 'slate' })
        .select('id')
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create label.' };
      labelIdByName.set(norm(name), data.id);
      labelsCreated += 1;
    }

    // For each target (row, column) cell, fetch the current max
    // position and append imported cards after it.
    const positionPerCell = new Map<string, number>();
    let cardsCreated = 0;
    for (const card of parsed.cards) {
      const rowId = rowIdByTitle.get(norm(card.rowTitle));
      const columnId = columnIdByTitle.get(norm(card.columnTitle));
      if (!rowId || !columnId) continue;
      const cellKey = `${rowId}:${columnId}`;

      if (!positionPerCell.has(cellKey)) {
        const { data: last } = await supabase
          .from('cards')
          .select('position')
          .eq('board_id', boardId)
          .eq('row_id', rowId)
          .eq('column_id', columnId)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle();
        positionPerCell.set(cellKey, (last?.position ?? -1) + 1);
      }
      const position = positionPerCell.get(cellKey) as number;
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
          .map((name) => labelIdByName.get(norm(name)))
          .filter((id): id is string => Boolean(id))
          .map((labelId) => ({ card_id: created.id, label_id: labelId }));
        if (links.length > 0) {
          const { error: linkErr } = await supabase.from('card_labels').insert(links);
          if (linkErr) return { ok: false, error: linkErr.message };
        }
      }
      cardsCreated += 1;
    }

    revalidatePath(`/b/${boardId}`);
    revalidatePath('/boards');
    return {
      ok: true,
      counts: { rowsCreated, columnsCreated, labelsCreated, cardsCreated },
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
