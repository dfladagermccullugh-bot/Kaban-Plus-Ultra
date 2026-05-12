'use client';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import type { Database } from '@kpu/db';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for Client Components.
 * Uses the public anon key + the user's JWT (managed by @supabase/ssr cookies).
 * RLS enforces authorization.
 */
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
