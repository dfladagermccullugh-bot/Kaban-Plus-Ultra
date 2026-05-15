/**
 * Bundled self-host deploys point server-side Supabase clients at
 * SUPABASE_INTERNAL_URL (http://kong:8000). `getPublicUrl()` /
 * `createSignedUrl()` string-concatenate that origin, so a URL bound for an
 * `<img src>` would point at an unreachable internal host. `toPublicStorageUrl`
 * is the per-push guard against that regression class (ADR 0022/0023/0024) —
 * deploy-smoke.yml is the heavy E2E proxy, this is the fast one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPublicStorageUrl } from '../lib/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

const SIGNED = '/storage/v1/object/sign/card-images/abc/def.png?token=eyJ.fake.sig&download=';
const PUBLIC = '/storage/v1/object/public/avatars/uid/avatar.png';

describe('toPublicStorageUrl', () => {
  it('is a no-op when SUPABASE_INTERNAL_URL is unset (hosted / local dev)', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co');
    const url = `https://proj.supabase.co${PUBLIC}`;
    expect(toPublicStorageUrl(url)).toBe(url);
  });

  it('rewrites the internal origin to the public origin for a public URL', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    expect(toPublicStorageUrl(`http://kong:8000${PUBLIC}`)).toBe(`http://localhost${PUBLIC}`);
  });

  it('rewrites a signed URL while preserving its query string', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://kaban.example.com');
    expect(toPublicStorageUrl(`http://kong:8000${SIGNED}`)).toBe(
      `https://kaban.example.com${SIGNED}`,
    );
  });

  it('leaves a URL that is not on the internal origin untouched', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    const already = `http://localhost${PUBLIC}`;
    expect(toPublicStorageUrl(already)).toBe(already);
  });

  it('tolerates trailing slashes on either env value', () => {
    vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://kong:8000/');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://kaban.example.com/');
    expect(toPublicStorageUrl(`http://kong:8000${PUBLIC}`)).toBe(
      `https://kaban.example.com${PUBLIC}`,
    );
  });
});
