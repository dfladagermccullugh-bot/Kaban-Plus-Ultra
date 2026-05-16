import { requestPublicOrigin } from '@/lib/request-origin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Public origin, not request.url (internal bind behind Caddy — ADR 0026).
  const target = new URL('/', requestPublicOrigin(request));
  return NextResponse.redirect(target, { status: 303 });
}
