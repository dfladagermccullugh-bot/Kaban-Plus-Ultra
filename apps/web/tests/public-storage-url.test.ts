/**
 * Bundled self-host deploys point server-side Supabase clients at
 * SUPABASE_INTERNAL_URL (http://kong:8000). `getPublicUrl()` /
 * `createSignedUrl()` / `auth.admin.generateLink()` string-concatenate that
 * origin, so a URL bound for an `<img src>` or a clickable magic-link would
 * point at an unreachable internal host. `toPublicUrl` is the per-push guard
 * against that regression class (ADR 0022/0023/0024/0026) — deploy-smoke.yml
 * is the heavy E2E proxy, this is the fast one.
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
