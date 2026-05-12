'use client';

import { cn } from '@kpu/ui';
import { Check, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SWATCH_COLORS, type SwatchColor, swatchClass } from './swatches';
import type { LabelModel } from './types';

type Props = {
  allLabels: LabelModel[];
  selectedIds: string[];
  onToggle: (labelId: string) => void;
  onCreate: (name: string, color: string) => void | Promise<void>;
  onClose: () => void;
};

export function LabelPicker({ allLabels, selectedIds, onToggle, onCreate, onClose }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<SwatchColor>('indigo');

  useEffect(() => {
    if (adding) newInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function submitNew() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed, color);
    setName('');
    setAdding(false);
  }

  return (
    <div
      ref={wrapperRef}
      className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-bg-elevated p-2 shadow-md"
    >
      <div className="max-h-56 overflow-y-auto">
        {allLabels.length === 0 && !adding && (
          <p className="px-2 py-1 text-xs text-text-muted">No labels yet.</p>
        )}
        {allLabels.map((label) => {
          const selected = selectedIds.includes(label.id);
          return (
            <button
              key={label.id}
              type="button"
              onClick={() => onToggle(label.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-surface"
            >
              <span
                className={cn('inline-block h-3 w-3 rounded-sm', swatchClass(label.color))}
                aria-hidden
              />
              <span className="flex-1 truncate">{label.name}</span>
              {selected && <Check size={12} strokeWidth={1.5} aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="mt-2 border-t border-border pt-2">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitNew();
            }}
            className="space-y-2"
          >
            <input
              ref={newInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setAdding(false);
                  setName('');
                }
              }}
              maxLength={40}
              placeholder="Label name"
              className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs focus-visible:border-accent focus-visible:outline-none"
            />
            <div className="flex flex-wrap gap-1">
              {SWATCH_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    'h-5 w-5 rounded-sm border border-transparent',
                    swatchClass(c),
                    color === c && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-elevated',
                  )}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setName('');
                }}
                className="rounded-sm px-2 py-1 text-xs text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-sm bg-accent px-2 py-1 text-xs text-accent-fg hover:bg-accent/90"
              >
                Create
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex w-full items-center gap-1 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface hover:text-text"
          >
            <Plus size={12} strokeWidth={1.5} aria-hidden />
            New label
          </button>
        )}
      </div>
    </div>
  );
}
