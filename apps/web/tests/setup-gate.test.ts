/**
 * The setup-state token check is the only thing standing between a fresh
 * deploy and an attacker creating the workspace owner. Lock its semantics
 * down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSetupToken } from '../app/setup/setup-state';

beforeEach(() => {
  vi.stubEnv('SETUP_TOKEN', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('checkSetupToken', () => {
  it('refuses when SETUP_TOKEN is empty (treat blank as disabled)', () => {
    const r = checkSetupToken('anything');
    expect(r).toEqual({ ok: false, reason: 'no-token' });
  });

  it('refuses when supplied token is missing', () => {
    vi.stubEnv('SETUP_TOKEN', 'expected');
    const r = checkSetupToken(undefined);
    expect(r).toEqual({ ok: false, reason: 'bad-token' });
  });

  it('refuses when supplied token mismatches', () => {
    vi.stubEnv('SETUP_TOKEN', 'expected');
    const r = checkSetupToken('wrong');
    expect(r).toEqual({ ok: false, reason: 'bad-token' });
  });

  it('refuses when tokens differ by length only (constant-time short-circuit)', () => {
    vi.stubEnv('SETUP_TOKEN', 'expected');
    const r = checkSetupToken('expecte');
    expect(r).toEqual({ ok: false, reason: 'bad-token' });
  });

  it('accepts when tokens match exactly', () => {
    vi.stubEnv('SETUP_TOKEN', 'matches-perfectly');
    const r = checkSetupToken('matches-perfectly');
    expect(r).toEqual({ ok: true });
  });
});
