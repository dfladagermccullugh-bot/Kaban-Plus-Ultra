import 'server-only';

import { createAdmin } from '@/lib/supabase/admin';
import { type SetupGate, checkSetupToken } from './setup-state';

export async function isWorkspaceEmpty(): Promise<boolean> {
  const admin = createAdmin();
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count ?? 0) === 0;
}

export async function setupGate(suppliedToken: string | undefined): Promise<SetupGate> {
  const tokenCheck = checkSetupToken(suppliedToken);
  if (!tokenCheck.ok) {
    // Without this a misconfigured self-host gets an undebuggable silent 404.
    console.error(`[setup-gate] denied: token check = ${tokenCheck.reason}`);
    return tokenCheck;
  }
  try {
    const empty = await isWorkspaceEmpty();
    if (!empty) return { ok: false, reason: 'already-claimed' };
  } catch (err) {
    console.error('[setup-gate] denied: workspace-empty probe threw —', err);
    return { ok: false, reason: 'env' };
  }
  return { ok: true };
}
