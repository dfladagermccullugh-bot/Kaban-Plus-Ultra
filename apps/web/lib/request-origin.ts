import type { NextRequest } from 'next/server';

/**
 * The public origin the browser actually used, for building absolute
 * redirects.
 *
 * Next's standalone server reports `request.url` as its *internal* bind
 * (`HOSTNAME:PORT` → `http://0.0.0.0:3000` in the bundled self-host), not
 * the host the browser hit, so `NextResponse.redirect(new URL(p, request.url))`
 * sends the browser to an unreachable address. Behind Caddy the real values
 * arrive as `X-Forwarded-Host` / `X-Forwarded-Proto` (Caddy sets both by
 * default); fall back to the `Host` header, then to the request URL's own
 * origin (hosted / local dev, no proxy). See docs/DECISIONS/0026.
 */
export function requestPublicOrigin(request: NextRequest): string {
  const reqUrl = new URL(request.url);
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? reqUrl.host;
  const proto = request.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}
