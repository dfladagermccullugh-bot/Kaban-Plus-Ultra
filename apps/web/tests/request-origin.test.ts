/**
 * Next's standalone server reports request.url as its internal bind
 * (http://0.0.0.0:3000) behind Caddy, so auth-callback / sign-out absolute
 * redirects pointed the browser at an unreachable host (live trial
 * 2026-05-16). `requestPublicOrigin` reads the X-Forwarded-* headers Caddy
 * sends. Per-push guard for that class — deploy-smoke.yml is the heavy E2E
 * proxy (it asserts the 302 Location host). See ADR 0026.
 */

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { requestPublicOrigin } from '../lib/request-origin';

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new Request(url, { headers }));
}

describe('requestPublicOrigin', () => {
  it('uses X-Forwarded-Host/-Proto over the internal request.url (the live bug)', () => {
    const r = req('http://0.0.0.0:3000/auth/callback?next=/boards', {
      'x-forwarded-host': 'localhost',
      'x-forwarded-proto': 'http',
    });
    expect(requestPublicOrigin(r)).toBe('http://localhost');
  });

  it('honors a forwarded https proto + real hostname', () => {
    const r = req('http://0.0.0.0:3000/sign-out', {
      'x-forwarded-host': 'kaban.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(requestPublicOrigin(r)).toBe('https://kaban.example.com');
  });

  it('falls back to the Host header with the request scheme (no proxy)', () => {
    const r = req('http://localhost:3000/auth/callback', { host: 'localhost:3000' });
    expect(requestPublicOrigin(r)).toBe('http://localhost:3000');
  });

  it('falls back to the request URL origin when no host headers exist', () => {
    const r = req('https://proj.example.com/auth/callback');
    expect(requestPublicOrigin(r)).toBe('https://proj.example.com');
  });
});
