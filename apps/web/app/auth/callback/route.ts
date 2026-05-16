import { requestPublicOrigin } from '@/lib/request-origin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth callback for magic links and OAuth.
 * Exchanges the `?code=...` from Supabase for a session cookie, then redirects
 * to `?next=...` (defaults to /boards). Redirect base is the public origin,
 * not request.url (internal bind behind Caddy — see docs/DECISIONS/0026).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');
  const next = nextParam?.startsWith('/') ? nextParam : '/boards';
  const origin = requestPublicOrigin(request);

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const err = new URL('/sign-in', origin);
    err.searchParams.set('error', error.message);
    return NextResponse.redirect(err);
  }

  return NextResponse.redirect(new URL(next, origin));
}
