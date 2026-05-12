'use client';

import { cn } from '@kpu/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';

type Props = {
  trigger: (props: { open: boolean; onClick: () => void }) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
};

export function OptionsPopover({ trigger, children, align = 'end' }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const node = wrapperRef.current;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      {trigger({ open, onClick: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            'absolute top-full z-30 mt-1 w-56 rounded-md border border-border bg-bg-elevated p-2 shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}
