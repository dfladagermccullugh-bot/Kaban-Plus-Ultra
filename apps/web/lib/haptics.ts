/**
 * Thin wrapper around `@capacitor/haptics` with a web fallback to the
 * standard `navigator.vibrate` API. Safe to call from server code (no-op).
 *
 * The Capacitor web shim already proxies to `navigator.vibrate` on
 * supported browsers, but importing it here pins the API surface for both
 * platforms and keeps the call sites a single line. `respects
 * prefers-reduced-motion` per the golden rules in CLAUDE.md.
 */
import { Haptics, ImpactStyle } from '@capacitor/haptics';

type Strength = 'light' | 'medium';

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function hapticImpact(strength: Strength = 'light'): void {
  if (typeof window === 'undefined') return;
  if (reducedMotion()) return;
  const style = strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  void Haptics.impact({ style }).catch(() => {
    // Fall back to the Vibration API; ignore if the browser doesn't
    // expose it (Safari desktop, most iOS browsers in-page).
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(strength === 'medium' ? 16 : 8);
    }
  });
}
