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

/**
 * Supabase origin for server-side calls. In a bundled self-host deployment
 * the browser bundle has the public hostname inlined into
 * NEXT_PUBLIC_SUPABASE_URL at build time, but server-side code runs inside
 * the container where that hostname (`localhost` for a local-only deploy) is
 * the container itself, not the gateway. `docker/kaban-stack.yml` sets
 * SUPABASE_INTERNAL_URL=http://kong:8000 so server→Supabase hops stay on the
 * docker network. Falls back to the public URL (hosted Supabase / local dev,
 * where the var is unset). See docs/DECISIONS/0022.
 */
export function getServerSupabaseUrl(): string {
  return process.env.SUPABASE_INTERNAL_URL ?? getSupabaseUrl();
}

export function getSupabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/**
 * Rewrite a URL built by a server-side Supabase client to the public origin
 * the browser can actually reach.
 *
 * `getPublicUrl()` / `createSignedUrl()` / `auth.admin.generateLink()` all
 * string-concatenate the *client's* base origin. Server-side clients use
 * `getServerSupabaseUrl()` — `SUPABASE_INTERNAL_URL` (`http://kong:8000`) in
 * a bundled deploy — so a URL destined for an `<img src>` or a magic-link the
 * operator clicks would point at an unreachable internal host. The API hop
 * should stay internal; only the URL handed to the browser needs the public
 * origin (Caddy then proxies the Supabase paths back to Kong — see
 * docs/DECISIONS/0026). No-op when `SUPABASE_INTERNAL_URL` is unset (hosted
 * Supabase / local dev) or the URL isn't on the internal origin. See
 * docs/DECISIONS/0024.
 */
export function toPublicUrl(url: string): string {
  const internal = process.env.SUPABASE_INTERNAL_URL;
  if (!internal) return url;
  const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '');
  const from = stripTrailingSlash(internal);
  return url.startsWith(from) ? stripTrailingSlash(getSupabaseUrl()) + url.slice(from.length) : url;
}
