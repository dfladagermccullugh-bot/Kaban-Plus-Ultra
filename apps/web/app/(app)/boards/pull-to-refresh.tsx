'use client';

import { hapticImpact } from '@/lib/haptics';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh wrapper for the boards list. Active only on touch
 * devices (skipped if the primary pointer is fine). Triggers a haptic
 * on the threshold cross and a `router.refresh()` on release past the
 * threshold; everything else uses Framer-spring-style transforms via
 * inline CSS to keep the imported runtime cost at zero.
 */
const THRESHOLD = 72;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const armedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      armedRef.current = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current == null || refreshing) return;
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band the pull so it feels right past the threshold.
      const clamped = Math.min(MAX_PULL, dy * 0.55);
      setPull(clamped);
      if (clamped >= THRESHOLD && !armedRef.current) {
        armedRef.current = true;
        hapticImpact('light');
      } else if (clamped < THRESHOLD && armedRef.current) {
        armedRef.current = false;
      }
    }
    function onTouchEnd() {
      if (startY.current == null || refreshing) return;
      const shouldRefresh = pull >= THRESHOLD;
      startY.current = null;
      if (shouldRefresh) {
        setRefreshing(true);
        hapticImpact('medium');
        setPull(THRESHOLD);
        router.refresh();
        // The refresh resolves quickly when there are no boards; pin the
        // spinner for a frame so it doesn't strobe on a fast network.
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 350);
      } else {
        setPull(0);
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pull, refreshing, router]);

  const armed = pull >= THRESHOLD;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
        style={{
          transform: `translateY(${pull > 0 ? pull - 32 : -64}px)`,
          opacity: pull > 0 ? Math.min(1, pull / THRESHOLD) : 0,
          transition: pull === 0 ? 'transform 200ms ease-out, opacity 200ms ease-out' : undefined,
        }}
      >
        <div className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-muted shadow">
          <RefreshCw
            size={16}
            strokeWidth={1.5}
            className={refreshing || armed ? 'animate-spin' : ''}
          />
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: pull === 0 ? 'transform 200ms ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </>
  );
}
