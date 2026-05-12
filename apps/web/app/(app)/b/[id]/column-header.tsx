'use client';

import { cn } from '@kpu/ui';
import { ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OptionsPopover } from './options-popover';
import { SWATCH_BG, SWATCH_COLORS, swatchClass } from './swatches';
import type { ColumnModel } from './types';

type Props = {
  column: ColumnModel;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  cardCount: number;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onColorChange: (color: string) => void;
  onWipLimitChange: (limit: number | null) => void;
};

export function ColumnHeader({
  column,
  isFirst,
  isLast,
  canDelete,
  cardCount,
  onRename,
  onDelete,
  onMove,
  onColorChange,
  onWipLimitChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.title);
  const [wipDraft, setWipDraft] = useState(
    column.wip_limit === null ? '' : String(column.wip_limit),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const dot = swatchClass(column.color, 'indigo');
  const overLimit = column.wip_limit !== null && cardCount > column.wip_limit;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setWipDraft(column.wip_limit === null ? '' : String(column.wip_limit));
  }, [column.wip_limit]);

  function commit() {
    const next = value.trim();
    if (next && next !== column.title) onRename(next);
    else setValue(column.title);
    setEditing(false);
  }

  function commitWipLimit() {
    const trimmed = wipDraft.trim();
    if (trimmed === '') {
      if (column.wip_limit !== null) onWipLimitChange(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      setWipDraft(column.wip_limit === null ? '' : String(column.wip_limit));
      return;
    }
    if (n !== column.wip_limit) onWipLimitChange(n);
  }

  return (
    <div className="sticky top-0 z-10 group flex items-center gap-2 border-b border-r border-border bg-bg-elevated p-2">
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
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
                  setValue(column.title);
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
              setValue(column.title);
              setEditing(true);
            }}
            className="block w-full truncate text-left text-sm font-medium hover:text-accent"
          >
            {column.title}
          </button>
        )}
      </div>
      {column.wip_limit !== null && (
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium tabular-nums',
            overLimit
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-border bg-surface text-text-muted',
          )}
          aria-label={`${cardCount} of ${column.wip_limit} cards`}
        >
          {cardCount}/{column.wip_limit}
        </span>
      )}
      <OptionsPopover
        align="end"
        trigger={({ open, onClick }) => (
          <button
            type="button"
            aria-label="Column options"
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
              aria-label="Move column left"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={14} strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={isLast}
              aria-label="Move column right"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
            </button>
            <span className="text-xs text-text-muted">Reorder</span>
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-text-muted">Color</legend>
            <div className="flex flex-wrap gap-1">
              {SWATCH_COLORS.map((c) => {
                const active = (column.color ?? 'indigo') === c;
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
          <label className="flex items-center justify-between gap-2 text-xs text-text-muted">
            <span>WIP limit</span>
            <input
              type="number"
              min={1}
              max={999}
              value={wipDraft}
              onChange={(e) => setWipDraft(e.target.value)}
              onBlur={commitWipLimit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitWipLimit();
                }
              }}
              placeholder="—"
              className="h-7 w-16 rounded-sm border border-border bg-bg px-2 text-right text-sm text-text focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete column "${column.title}" and all its cards?`)) onDelete();
              }}
              className="inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-text-muted hover:bg-surface hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              Delete column
            </button>
          )}
        </div>
      </OptionsPopover>
    </div>
  );
}
