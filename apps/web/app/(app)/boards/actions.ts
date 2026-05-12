'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return { supabase, user };
}

function validateTitle(raw: unknown, max = 120): string | { error: string } {
  const trimmed = String(raw ?? '').trim();
  if (trimmed.length === 0) return { error: 'Title is required.' };
  if (trimmed.length > max) return { error: `Title must be ${max} characters or fewer.` };
  return trimmed;
}

export async function createBoard(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const title = validateTitle(formData.get('title')) as string;
  if (typeof title !== 'string') return;

  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .insert({ title, owner_id: user.id, cover_color: 'indigo' })
    .select('id')
    .single();
  if (boardErr || !board) throw new Error(boardErr?.message ?? 'Failed to create board.');

  const { error: rowErr } = await supabase
    .from('rows')
    .insert({ board_id: board.id, title: 'To do', color: 'slate', position: 0 });
  if (rowErr) throw new Error(rowErr.message);

  const { error: colErr } = await supabase
    .from('columns')
    .insert({ board_id: board.id, title: 'Now', color: 'indigo', position: 0 });
  if (colErr) throw new Error(colErr.message);

  revalidatePath('/boards');
  redirect(`/b/${board.id}`);
}

export async function renameBoard(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const id = String(formData.get('id') ?? '');
    const titleResult = validateTitle(formData.get('title'));
    if (typeof titleResult !== 'string') return { ok: false, error: titleResult.error };
    if (!id) return { ok: false, error: 'Missing board id.' };

    const { error } = await supabase.from('boards').update({ title: titleResult }).eq('id', id);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/boards');
    revalidatePath(`/b/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function deleteBoard(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await supabase.from('boards').delete().eq('id', id);
  revalidatePath('/boards');
  redirect('/boards');
}
