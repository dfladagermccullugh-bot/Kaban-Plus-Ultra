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
 * In a bundled self-host the server talks to Supabase over the internal
 * docker origin (`SUPABASE_INTERNAL_URL`, `http://kong:8000`). Two classes
 * of server-built URL then leak an unreachable host to the browser:
 *
 *  - storage-js `getPublicUrl()` / `createSignedUrl()` string-concatenate
 *    the *client* base origin → `http://kong:8000/storage/v1/…`;
 *  - GoTrue's `admin/generate_link` stamps the **incoming request host**
 *    into `action_link` — Kong renders that as `http://kong` (no port),
 *    *not* the client base and *not* `API_EXTERNAL_URL`.
 *
 * So we can't prefix-match a single known internal string. Instead swap the
 * URL's whole origin (whatever it is) for the public Supabase origin,
 * preserving path + query + hash byte-for-byte. Caddy then proxies the
 * Supabase paths back to Kong (see docs/DECISIONS/0026). No-op when
 * `SUPABASE_INTERNAL_URL` is unset (hosted Supabase / local dev). See
 * docs/DECISIONS/0024 + 0026.
 */
export function toPublicUrl(url: string): string {
  if (!process.env.SUPABASE_INTERNAL_URL) return url;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return url;
  }
  return new URL(getSupabaseUrl()).origin + url.slice(origin.length);
}
