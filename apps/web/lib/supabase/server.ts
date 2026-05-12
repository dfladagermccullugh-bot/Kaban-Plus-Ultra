import 'server-only';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import type { Database } from '@kpu/db';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Server Components, Route Handlers,
 * and Server Actions. Uses the anon key + the user's JWT cookies.
 * RLS enforces authorization.
 *
 * ⚠️ Never use the service role here. For privileged operations, use a
 * dedicated module under `app/api/admin/**` and import from `@kpu/db` directly.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Setting cookies from a Server Component is disallowed; safe to ignore
          // when the middleware is refreshing the session.
        }
      },
    },
  });
}
