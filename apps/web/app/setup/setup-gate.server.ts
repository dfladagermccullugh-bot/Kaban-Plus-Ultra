import 'server-only';

import { getServerSupabaseUrl } from '@/lib/env';
import { createAdmin } from '@/lib/supabase/admin';
import { type SetupGate, checkSetupToken } from './setup-state';

// TEMP TRIAL DIAGNOSTIC — remove before finalizing.
async function diagnoseAdminReachability(): Promise<void> {
  const url = getServerSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  console.error(`[setup-gate][diag] serverSupabaseUrl=${url} keyLen=${key.length}`);
  try {
    const r = await fetch(`${url}/rest/v1/profiles?select=id`, {
      method: 'HEAD',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      cache: 'no-store',
    });
    console.error(
      `[setup-gate][diag] same-runtime raw fetch -> status=${r.status} content-range=${r.headers.get(
        'content-range',
      )}`,
    );
  } catch (e) {
    console.error('[setup-gate][diag] same-runtime raw fetch THREW —', {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      cause: (e as { cause?: unknown })?.cause,
    });
  }
}

export async function isWorkspaceEmpty(): Promise<boolean> {
  const admin = createAdmin();
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count ?? 0) === 0;
}

// TEMP TRIAL DIAGNOSTIC — wrap fetch to capture exactly what supabase-js
// sends/receives during the real probe. Remove before finalizing.
async function isWorkspaceEmptySpied(): Promise<boolean> {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const url = input instanceof Request ? input.url : String(input);
    try {
      const res = await orig(input as RequestInfo, init);
      console.error(
        `[setup-gate][spy] ${method} ${url} -> ${res.status} ${res.statusText} cr=${res.headers.get(
          'content-range',
        )} ct=${res.headers.get('content-type')}`,
      );
      return res;
    } catch (e) {
      console.error(`[setup-gate][spy] ${method} ${url} -> THREW`, {
        name: (e as Error)?.name,
        message: (e as Error)?.message,
        cause: (e as { cause?: unknown })?.cause,
      });
      throw e;
    }
  }) as typeof fetch;
  try {
    return await isWorkspaceEmpty();
  } finally {
    globalThis.fetch = orig;
  }
}

export async function setupGate(suppliedToken: string | undefined): Promise<SetupGate> {
  const tokenCheck = checkSetupToken(suppliedToken);
  if (!tokenCheck.ok) {
    // A misconfigured self-host otherwise gets an undebuggable silent 404.
    console.error(`[setup-gate] denied: token check = ${tokenCheck.reason}`);
    return tokenCheck;
  }
  try {
    const empty = await isWorkspaceEmptySpied();
    if (!empty) return { ok: false, reason: 'already-claimed' };
  } catch (err) {
    const e = err as Record<string, unknown> & { stack?: string; cause?: unknown };
    console.error('[setup-gate] denied: workspace-empty probe threw —', {
      ctor: err?.constructor?.name,
      ownProps: JSON.stringify(err, Object.getOwnPropertyNames(err ?? {})),
      stack: e?.stack,
      cause: e?.cause,
    });
    // TEMP TRIAL DIAGNOSTIC — remove before finalizing.
    await diagnoseAdminReachability();
    return { ok: false, reason: 'env' };
  }
  return { ok: true };
}
