/**
 * Read-once env helpers with clear error messages.
 *
 * We read at call time (not module load) so build-time prerender doesn't
 * crash when env is absent locally. Pages that need Supabase fail at request
 * time with a helpful message instead.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required env var ${key}. Copy .env.example to .env.local and fill in real values.`,
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
