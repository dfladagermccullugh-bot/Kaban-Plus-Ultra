'use client';

import { cn } from '@kpu/ui';
import { X } from 'lucide-react';
import { swatchClass } from './swatches';
import type { LabelModel } from './types';

type Props = {
  labels: LabelModel[];
  selectedIds: string[];
  onToggle: (labelId: string) => void;
  onClear: () => void;
};

export function LabelFilterBar({ labels, selectedIds, onToggle, onClear }: Props) {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-elevated/60 px-4 py-2">
      <span className="text-xs text-text-muted">Filter:</span>
      {labels.map((label) => {
        const active = selectedIds.includes(label.id);
        return (
          <button
            key={label.id}
            type="button"
            onClick={() => onToggle(label.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
              active
                ? cn('border-transparent text-white', swatchClass(label.color))
                : 'border-border bg-bg text-text-muted hover:bg-surface hover:text-text',
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                active ? 'bg-white/80' : swatchClass(label.color),
              )}
              aria-hidden
            />
            {label.name}
          </button>
        );
      })}
      {selectedIds.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text"
        >
          <X size={12} strokeWidth={1.5} aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}
