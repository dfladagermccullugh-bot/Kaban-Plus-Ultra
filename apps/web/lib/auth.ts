import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  accentColor: string | null;
};

/**
 * Returns the signed-in user with their profile, or `null` if signed-out
 * OR if Supabase env isn't configured locally.
 *
 * Callers that need an authed user should `if (!user) redirect('/sign-in?next=...')`.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, accent_color')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email ?? '',
      displayName: profile?.display_name ?? null,
      accentColor: profile?.accent_color ?? null,
    };
  } catch {
    return null;
  }
}
