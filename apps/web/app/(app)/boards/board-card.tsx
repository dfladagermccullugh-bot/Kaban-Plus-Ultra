'use client';

import { Button, Input, cn } from '@kpu/ui';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteBoard, renameBoard } from './actions';

type Props = {
  id: string;
  title: string;
  coverColor: string | null;
  updatedAt: string;
};

const COVER_BG: Record<string, string> = {
  indigo: 'bg-accent/80',
  amber: 'bg-amber-500/80',
  slate: 'bg-slate-500/80',
  green: 'bg-emerald-500/80',
  rose: 'bg-rose-500/80',
  violet: 'bg-violet-500/80',
  sky: 'bg-sky-500/80',
  teal: 'bg-teal-500/80',
};

export function BoardCard({ id, title, coverColor, updatedAt }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [optimisticTitle, setOptimisticTitle] = useState(title);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRename(formData: FormData) {
    const next = String(formData.get('title') ?? '').trim();
    if (!next || next === optimisticTitle) {
      setRenaming(false);
      return;
    }
    setOptimisticTitle(next);
    setRenaming(false);
    startTransition(async () => {
      const result = await renameBoard(formData);
      if (!result.ok) {
        setError(result.error);
        setOptimisticTitle(title);
      }
    });
  }

  function onDelete(formData: FormData) {
    if (!confirm(`Delete "${optimisticTitle}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteBoard(formData);
    });
  }

  const swatch = (coverColor && COVER_BG[coverColor]) ?? 'bg-accent/80';
  const updated = new Date(updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-md border border-border bg-bg-elevated shadow-sm transition-shadow hover:shadow-md',
        pending && 'opacity-60',
      )}
    >
      <Link
        href={`/b/${id}`}
        className={cn('block h-20', swatch)}
        aria-label={`Open ${optimisticTitle}`}
      />
      <div className="flex flex-1 items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form action={onRename} className="flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <Input
                name="title"
                defaultValue={optimisticTitle}
                maxLength={120}
                required
                autoFocus
                onBlur={(e) => onRename(new FormData(e.currentTarget.form ?? undefined))}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRenaming(false);
                }}
                className="h-9 text-sm"
              />
            </form>
          ) : (
            <>
              <Link
                href={`/b/${id}`}
                className="block truncate text-sm font-semibold hover:text-accent"
              >
                {optimisticTitle}
              </Link>
              <p className="mt-1 text-xs text-text-muted">Updated {updated}</p>
            </>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Rename board"
            onClick={() => setRenaming(true)}
            className="h-8 w-8"
          >
            <Pencil size={14} strokeWidth={1.5} aria-hidden />
          </Button>
          <form action={onDelete}>
            <input type="hidden" name="id" value={id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Delete board"
              disabled={pending}
              className="h-8 w-8 text-text-muted hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </article>
  );
}
