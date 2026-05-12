'use client';

import { cn } from '@kpu/ui';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ColumnModel } from './types';

const COLOR_DOT: Record<string, string> = {
  slate: 'bg-slate-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  indigo: 'bg-accent',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
};

type Props = {
  column: ColumnModel;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

export function ColumnHeader({
  column,
  isFirst,
  isLast,
  canDelete,
  onRename,
  onDelete,
  onMove,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const dot = (column.color && COLOR_DOT[column.color]) ?? COLOR_DOT.indigo;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = value.trim();
    if (next && next !== column.title) onRename(next);
    else setValue(column.title);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center gap-2 border-b border-r border-border bg-bg-elevated p-2',
        'group',
      )}
    >
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
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label="Move column left"
          className="text-text-muted hover:text-text disabled:opacity-30"
        >
          <ChevronLeft size={14} strokeWidth={1.5} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label="Move column right"
          className="text-text-muted hover:text-text disabled:opacity-30"
        >
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete column "${column.title}" and all its cards?`)) onDelete();
            }}
            aria-label="Delete column"
            className="ml-1 text-text-muted hover:text-danger"
          >
            <Trash2 size={14} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
