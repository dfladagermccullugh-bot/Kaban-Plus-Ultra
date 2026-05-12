'use client';

import { cn } from '@kpu/ui';
import { ChevronDown, ChevronRight, ChevronUp, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OptionsPopover } from './options-popover';
import { SWATCH_BG, SWATCH_COLORS, swatchClass } from './swatches';
import type { RowModel } from './types';

type Props = {
  row: RowModel;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onColorChange: (color: string) => void;
  onCollapseToggle: () => void;
};

export function RowHeader({
  row,
  isFirst,
  isLast,
  canDelete,
  onRename,
  onDelete,
  onMove,
  onColorChange,
  onCollapseToggle,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const dot = swatchClass(row.color);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = value.trim();
    if (next && next !== row.title) onRename(next);
    else setValue(row.title);
    setEditing(false);
  }

  return (
    <div className="sticky left-0 z-10 group flex items-start gap-2 border-b border-r border-border bg-bg-elevated p-2">
      <button
        type="button"
        aria-label={row.collapsed ? 'Expand row' : 'Collapse row'}
        onClick={onCollapseToggle}
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
      >
        {row.collapsed ? (
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
        ) : (
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
        )}
      </button>
      <span aria-hidden className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', dot)} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setValue(row.title);
                  setEditing(false);
                }
              }}
              maxLength={80}
              className="w-full rounded-sm border border-border bg-bg px-1 py-0.5 text-sm focus-visible:border-accent focus-visible:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setValue(row.title);
              setEditing(true);
            }}
            className="block w-full break-words text-left text-sm font-medium hover:text-accent"
          >
            {row.title}
          </button>
        )}
      </div>
      <OptionsPopover
        align="end"
        trigger={({ open, onClick }) => (
          <button
            type="button"
            aria-label="Row options"
            aria-expanded={open}
            onClick={onClick}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text',
              !open && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            )}
          >
            <MoreHorizontal size={14} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={isFirst}
              aria-label="Move row up"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp size={14} strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={isLast}
              aria-label="Move row down"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
            </button>
            <span className="text-xs text-text-muted">Reorder</span>
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-text-muted">Color</legend>
            <div className="flex flex-wrap gap-1">
              {SWATCH_COLORS.map((c) => {
                const active = (row.color ?? 'slate') === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={active}
                    onClick={() => onColorChange(c)}
                    className={cn(
                      'h-5 w-5 rounded-full ring-1 ring-transparent transition-shadow',
                      SWATCH_BG[c],
                      active ? 'ring-2 ring-text/50' : 'hover:ring-text/20',
                    )}
                  />
                );
              })}
            </div>
          </fieldset>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete row "${row.title}" and all its cards?`)) onDelete();
              }}
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-text-muted hover:bg-surface hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              Delete row
            </button>
          )}
        </div>
      </OptionsPopover>
    </div>
  );
}
