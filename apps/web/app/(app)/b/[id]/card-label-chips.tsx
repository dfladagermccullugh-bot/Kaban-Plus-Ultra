'use client';

import { cn } from '@kpu/ui';
import { X } from 'lucide-react';
import { swatchClass } from './swatches';
import type { LabelModel } from './types';

type Props = {
  labels: LabelModel[];
  onRemove?: (labelId: string) => void;
  compact?: boolean;
};

export function CardLabelChips({ labels, onRemove, compact = false }: Props) {
  if (labels.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', compact ? 'gap-0.5' : '')}>
      {labels.map((label) => (
        <span
          key={label.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm text-white',
            swatchClass(label.color),
            compact ? 'h-1.5 w-8' : 'px-1.5 py-0.5 text-[11px] font-medium',
          )}
          title={label.name}
        >
          {!compact && (
            <>
              <span className="truncate max-w-[8rem]">{label.name}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(label.id)}
                  aria-label={`Remove ${label.name}`}
                  className="opacity-80 hover:opacity-100"
                >
                  <X size={10} strokeWidth={2} aria-hidden />
                </button>
              )}
            </>
          )}
        </span>
      ))}
    </div>
  );
}
