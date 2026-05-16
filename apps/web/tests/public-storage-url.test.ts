/**
 * Bundled self-host deploys point server-side Supabase clients at
 * SUPABASE_INTERNAL_URL (http://kong:8000). storage-js concatenates that
 * origin (`http://kong:8000/storage/v1/…`); GoTrue's admin/generate_link
 * instead stamps the request host, which Kong renders as `http://kong` (no
 * port). Either way the browser can't reach it. `toPublicUrl` swaps the
 * whole origin (not a prefix match — the live trial proved the host varies)
 * for the public one. Per-push guard for that class (ADR 0022/0023/0024/
 * 0026); deploy-smoke.yml is the heavy E2E proxy, this is the fast one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPublicUrl } from '../lib/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

const SIGNED = '/storage/v1/object/sign/card-images/abc/def.png?token=eyJ.fake.sig&download=';
const PUBLIC = '/storage/v1/object/public/avatars/uid/avatar.png';
const MAGIC = '/auth/v1/verify?token=pkce_abc&type=magiclink&redirect_to=http://localhost/boards';

describe('toPublicUrl', () => {
  it('is a no-op when SUPABASE_INTERNAL_URL is unset (hosted / local dev)', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co');
    const url = `https://proj.supabase.co${PUBLIC}`;
    expect(toPublicUrl(url)).toBe(url);
  });

  it('rewrites the internal origin to the public origin for a public URL', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    expect(toPublicUrl(`http://kong:8000${PUBLIC}`)).toBe(`http://localhost${PUBLIC}`);
  });

  it('rewrites a signed URL while preserving its query string', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://kaban.example.com');
    expect(toPublicUrl(`http://kong:8000${SIGNED}`)).toBe(`https://kaban.example.com${SIGNED}`);
  });

  it('rewrites an auth magic-link so the operator can click it', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    expect(toPublicUrl(`http://kong:8000${MAGIC}`)).toBe(`http://localhost${MAGIC}`);
  });

  // Live trial (2026-05-16): GoTrue stamps the request host, which Kong
  // surfaces as `http://kong` — no port, ≠ SUPABASE_INTERNAL_URL. The old
  // prefix match silently no-op'd this and shipped an unclickable link.
  it('rewrites a magic-link whose host is not the literal internal URL', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    expect(toPublicUrl(`http://kong${MAGIC}`)).toBe(`http://localhost${MAGIC}`);
  });

  it('leaves a URL that is not on the internal origin untouched', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    const already = `http://localhost${PUBLIC}`;
    expect(toPublicUrl(already)).toBe(already);
  });

  it('tolerates trailing slashes on either env value', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000/');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://kaban.example.com/');
    expect(toPublicUrl(`http://kong:8000${PUBLIC}`)).toBe(`https://kaban.example.com${PUBLIC}`);
  });
});
