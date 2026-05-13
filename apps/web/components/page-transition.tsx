'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, y: -2 }}
        transition={reduce ? { duration: 0 } : SPRING}
        className="contents"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
