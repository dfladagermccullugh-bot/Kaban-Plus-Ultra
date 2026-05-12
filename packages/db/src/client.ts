import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export type KpuClient = SupabaseClient<Database>;

/**
 * Browser / user-scoped Supabase client. Uses the public anon key.
 * RLS enforces authorization based on the user's JWT.
 */
export function createBrowserClient(url: string, anonKey: string): KpuClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Server-side Supabase client with the **service role** key.
 *
 * ⚠️ SECURITY: This bypasses RLS. Only import from server-only modules
 * (Edge Functions, route handlers under `apps/web/app/api/admin/**`, scripts).
 * Never expose to the client bundle. See docs/SECURITY.md.
 */
export function createAdminClient(url: string, serviceRoleKey: string): KpuClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
