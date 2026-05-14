/**
 * "Setup mode" is the narrow window between a fresh `install-kaban.sh` deploy
 * and the moment the operator claims the workspace owner account. It is
 * gated on three things, all of which must hold:
 *
 *  1. `SETUP_TOKEN` is set in the server env.
 *  2. The request supplied `?t=<token>` and it matches exactly.
 *  3. The `profiles` table is empty — i.e. no owner has been claimed yet.
 *
 * Once any profile exists, `/setup` is gone for good. Re-bootstrapping
 * requires deleting the user out of band, which is intentional friction.
 *
 * The token comparison is constant-time so a wrong guess doesn't leak
 * timing info. The query string lookup is fine to expose because the
 * token is single-use and embedded in the install banner.
 *
 * This module is deliberately pure (no `server-only`, no Supabase deps)
 * so the gate can be unit-tested without standing up an admin client.
 * The admin-dependent half lives in `./setup-gate.server.ts`.
 */
export type SetupGate =
  | { ok: true }
  | { ok: false; reason: 'no-token' | 'bad-token' | 'already-claimed' | 'env' };

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkSetupToken(suppliedToken: string | undefined): SetupGate {
  const expected = process.env.SETUP_TOKEN;
  if (!expected || expected.length === 0) return { ok: false, reason: 'no-token' };
  if (!suppliedToken || !constantTimeEqual(suppliedToken, expected)) {
    return { ok: false, reason: 'bad-token' };
  }
  return { ok: true };
}
