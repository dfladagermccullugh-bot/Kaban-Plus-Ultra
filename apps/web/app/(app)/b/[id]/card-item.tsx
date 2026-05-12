'use client';

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { cn } from '@kpu/ui';
import { GripVertical, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CardModel } from './types';

type Props = {
  card: CardModel;
  dragAttributes: DraggableAttributes;
  dragListeners: DraggableSyntheticListeners;
  onRename: (title: string) => void;
  onDelete: () => void;
};

export function CardItem({ card, dragAttributes, dragListeners, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = value.trim();
    if (next && next !== card.title) onRename(next);
    else setValue(card.title);
    setEditing(false);
  }

  return (
    <div className="group flex items-start gap-1 p-2">
      <button
        type="button"
        aria-label="Drag card"
        {...dragAttributes}
        {...dragListeners}
        className={cn(
          'mt-0.5 flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-text-muted opacity-0 transition-opacity group-hover:opacity-100',
          'touch-none active:cursor-grabbing',
        )}
      >
        <GripVertical size={14} strokeWidth={1.5} aria-hidden />
      </button>
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
                  setValue(card.title);
                  setEditing(false);
                }
              }}
              maxLength={200}
              className="w-full rounded-sm border border-border bg-bg px-1 py-0.5 text-sm focus-visible:border-accent focus-visible:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setValue(card.title);
              setEditing(true);
            }}
            className="block w-full break-words text-left text-sm hover:text-accent"
          >
            {card.title}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Delete card"
        onClick={onDelete}
        className="opacity-0 transition-opacity group-hover:opacity-100 text-text-muted hover:text-danger"
      >
        <Trash2 size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
