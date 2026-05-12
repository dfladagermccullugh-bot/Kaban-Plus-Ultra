'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isAccentColor } from './accent-colors';

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const displayName = String(formData.get('display_name') ?? '').trim();
  const accentColor = String(formData.get('accent_color') ?? '').trim();

  if (displayName.length === 0 || displayName.length > 80) {
    return { ok: false, error: 'Display name must be 1–80 characters.' };
  }
  if (!isAccentColor(accentColor)) {
    return { ok: false, error: 'Pick one of the accent colors.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, accent_color: accentColor })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/profile');
  return { ok: true };
}
