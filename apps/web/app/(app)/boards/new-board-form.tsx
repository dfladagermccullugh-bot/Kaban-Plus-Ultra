'use client';

import { Button, Input } from '@kpu/ui';
import { Plus } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { createBoard } from './actions';

export function NewBoardForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      await createBoard(formData);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden />
        New board
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      <Input
        ref={inputRef}
        name="title"
        placeholder="Board title"
        maxLength={120}
        required
        disabled={pending}
        onBlur={(e) => {
          if (e.currentTarget.value.trim() === '') setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-64"
      />
      <Button type="submit" disabled={pending} size="sm">
        {pending ? 'Creating…' : 'Create'}
      </Button>
    </form>
  );
}
