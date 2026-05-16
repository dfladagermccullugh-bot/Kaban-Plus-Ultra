'use server';

import { isAccentColor } from '@/app/profile/accent-colors';
import { getSiteUrl, toPublicUrl } from '@/lib/env';
import { createAdmin } from '@/lib/supabase/admin';
import { isWorkspaceEmpty } from './setup-gate.server';
import { checkSetupToken } from './setup-state';

export type ClaimResult =
  | { ok: true; email: string; magicLink: string | null }
  | { ok: false; error: string };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Claim the workspace owner account.
 *
 * Re-validates the setup gate inside the action so a stale page or a
 * direct POST can't bypass it. On success we generate a magic-link via
 * the auth admin API and return it for the success page — SMTP may not
 * be configured on a fresh `install-kaban.sh` deploy, so the operator
 * needs the link surfaced inline.
 */
export async function claimWorkspace(formData: FormData): Promise<ClaimResult> {
  const token = String(formData.get('setup_token') ?? '');
  const tokenCheck = checkSetupToken(token);
  if (!tokenCheck.ok) return { ok: false, error: 'Setup is not available.' };

  let empty: boolean;
  try {
    empty = await isWorkspaceEmpty();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Database unavailable.' };
  }
  if (!empty) return { ok: false, error: 'A workspace owner already exists.' };

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const displayName = String(formData.get('display_name') ?? '').trim();
  const accentColor = String(formData.get('accent_color') ?? '').trim();
  const avatar = formData.get('avatar');

  if (!isEmail(email)) return { ok: false, error: 'Enter a valid email.' };
  if (displayName.length === 0 || displayName.length > 80) {
    return { ok: false, error: 'Display name must be 1–80 characters.' };
  }
  if (!isAccentColor(accentColor)) {
    return { ok: false, error: 'Pick one of the accent colors.' };
  }

  const admin = createAdmin();

  // 1. Create the auth user. `email_confirm: true` skips the verification
  //    round-trip — the operator just generated this token from the host,
  //    so we already trust them. The signup trigger seeds the profile row
  //    + a demo board.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? 'Failed to create the owner account.' };
  }
  const userId = created.user.id;

  // 2. Patch the trigger-created profile with the operator's choices.
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ display_name: displayName, accent_color: accentColor })
    .eq('id', userId);
  if (profileErr) return { ok: false, error: profileErr.message };

  // 3. Optional avatar upload. Bypasses RLS via the service role; the path
  //    matches the bucket's per-user prefix policy so a future signed-in
  //    overwrite still works.
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > MAX_AVATAR_BYTES) {
      return { ok: false, error: 'Avatar must be 2 MB or smaller.' };
    }
    if (!ALLOWED_AVATAR_TYPES.has(avatar.type)) {
      return { ok: false, error: 'Avatar must be PNG, JPEG, or WebP.' };
    }
    const ext = avatar.type === 'image/png' ? 'png' : avatar.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadErr } = await admin.storage.from('avatars').upload(path, avatar, {
      contentType: avatar.type,
      upsert: true,
    });
    if (uploadErr) return { ok: false, error: uploadErr.message };

    const { data: pub } = admin.storage.from('avatars').getPublicUrl(path);
    const { error: avatarErr } = await admin
      .from('profiles')
      .update({ avatar_url: toPublicUrl(pub.publicUrl) })
      .eq('id', userId);
    if (avatarErr) return { ok: false, error: avatarErr.message };
  }

  // 4. Magic link for first sign-in. Best-effort: if `generateLink` fails
  //    (e.g. site URL mismatch) we still return success — the operator can
  //    use the regular `/sign-in` page now that the account exists.
  let magicLink: string | null = null;
  const redirectTo = `${getSiteUrl()}/auth/callback?next=/boards`;
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });
  if (linkData?.properties?.action_link) {
    // generateLink builds this off the admin client's internal origin
    // (kong:8000 in a bundled deploy); rewrite to the public origin so the
    // operator can actually click it. Caddy proxies /auth/v1/* back to Kong.
    magicLink = toPublicUrl(linkData.properties.action_link);
  }

  return { ok: true, email, magicLink };
}
