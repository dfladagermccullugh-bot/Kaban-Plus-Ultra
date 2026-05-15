import 'server-only';

import { getServerSupabaseUrl } from '@/lib/env';
import { type KpuClient, createAdminClient } from '@kpu/db';

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * ⚠️ Server-only. Only import from Server Actions / Route Handlers / scripts.
 * Never re-export from a client module. See docs/SECURITY.md.
 *
 * Used today for `auth.admin.inviteUserByEmail` during collaborator invites —
 * the rest of the codebase stays on the anon-keyed clients so RLS is the
 * authorization story.
 */
export function createAdmin(): KpuClient {
  const url = getServerSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Required for invites + privileged admin operations.',
    );
  }
  return createAdminClient(url, key);
}
