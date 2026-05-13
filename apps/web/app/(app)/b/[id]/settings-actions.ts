'use server';

import { recordAuditEvent } from '@/lib/audit';
import { getSiteUrl } from '@/lib/env';
import { createAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@kpu/db';
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

async function assertBoardAdmin(boardId: string): Promise<string> {
  const { supabase, user } = await authedClient();
  const { data: board } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .maybeSingle();
  if (!board) throw new Error('Board not found.');
  if (board.owner_id === user.id) return user.id;
  const { data: collab } = await supabase
    .from('board_collaborators')
    .select('role')
    .eq('board_id', boardId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!collab || collab.role !== 'admin') {
    throw new Error('Only the board owner or an admin can manage collaborators.');
  }
  return user.id;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: ReadonlyArray<Role> = ['viewer', 'editor', 'admin'];

// ─── Invites ─────────────────────────────────────────────────────────────

export async function inviteCollaborator(
  boardId: string,
  email: string,
  role: Role,
): Promise<ActionResult> {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) return { ok: false, error: 'Invalid email address.' };
    if (!ROLES.includes(role)) return { ok: false, error: 'Invalid role.' };
    const actorId = await assertBoardAdmin(boardId);

    const admin = createAdmin();

    // Directory lookup via `profiles.email` (populated by the auth-trigger as
    // of migration 0006). Scales without paginating `auth.admin.listUsers`.
    let targetUserId: string | null = null;
    let invited = false;
    const { data: existing, error: lookupErr } = await admin
      .from('profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle();
    if (lookupErr) return { ok: false, error: lookupErr.message };

    if (existing) {
      targetUserId = existing.id;
    } else {
      const { data: newUser, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
        trimmedEmail,
        { redirectTo: `${getSiteUrl()}/b/${boardId}` },
      );
      if (inviteErr || !newUser.user) {
        return { ok: false, error: inviteErr?.message ?? 'Failed to send invite.' };
      }
      targetUserId = newUser.user.id;
      invited = true;
    }

    // Insert / update the collaborator row. Use the admin client so this works
    // even before the auth trigger has finished provisioning a profile row.
    const { error: upsertErr } = await admin
      .from('board_collaborators')
      .upsert(
        { board_id: boardId, profile_id: targetUserId, role },
        { onConflict: 'board_id,profile_id' },
      );
    if (upsertErr) return { ok: false, error: upsertErr.message };

    await recordAuditEvent(boardId, actorId, 'collaborator.invite', {
      target_profile_id: targetUserId,
      target_email: trimmedEmail,
      role,
      new_user: invited,
    });

    revalidatePath(`/b/${boardId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function updateCollaboratorRole(
  boardId: string,
  profileId: string,
  role: Role,
): Promise<ActionResult> {
  try {
    if (!ROLES.includes(role)) return { ok: false, error: 'Invalid role.' };
    const actorId = await assertBoardAdmin(boardId);
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('board_collaborators')
      .update({ role })
      .eq('board_id', boardId)
      .eq('profile_id', profileId);
    if (error) return { ok: false, error: error.message };
    await recordAuditEvent(boardId, actorId, 'collaborator.role_update', {
      target_profile_id: profileId,
      role,
    });
    revalidatePath(`/b/${boardId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function removeCollaborator(
  boardId: string,
  profileId: string,
): Promise<ActionResult> {
  try {
    const actorId = await assertBoardAdmin(boardId);
    const { supabase } = await authedClient();
    const { error } = await supabase
      .from('board_collaborators')
      .delete()
      .eq('board_id', boardId)
      .eq('profile_id', profileId);
    if (error) return { ok: false, error: error.message };
    await recordAuditEvent(boardId, actorId, 'collaborator.remove', {
      target_profile_id: profileId,
    });
    revalidatePath(`/b/${boardId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

// ─── Share links ─────────────────────────────────────────────────────────

export async function rotateShareToken(
  boardId: string,
): Promise<ActionResult<{ token: string; url: string }>> {
  try {
    const { supabase, user } = await authedClient();
    const { data, error } = await supabase.rpc('rotate_share_token', { board_id: boardId });
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to rotate token.' };
    const url = `${getSiteUrl()}/s/${boardId}?t=${data}`;
    await recordAuditEvent(boardId, user.id, 'share_link.rotate', {});
    revalidatePath(`/b/${boardId}`);
    return { ok: true, data: { token: data, url } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

export async function revokeShareToken(boardId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await authedClient();
    const { error } = await supabase.rpc('revoke_share_token', { board_id: boardId });
    if (error) return { ok: false, error: error.message };
    await recordAuditEvent(boardId, user.id, 'share_link.revoke', {});
    revalidatePath(`/b/${boardId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}
