'use client';

import type { Role } from '@kpu/db';
import { Button, Input, cn } from '@kpu/ui';
import { Check, Copy, Link2, Loader2, Settings, Tag, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteLabel, updateLabel } from './actions';
import {
  inviteCollaborator,
  removeCollaborator,
  revokeShareToken,
  rotateShareToken,
  updateCollaboratorRole,
} from './settings-actions';
import { SWATCH_COLORS, type SwatchColor, swatchClass } from './swatches';
import type { LabelModel } from './types';

export type Collaborator = {
  profile_id: string;
  display_name: string;
  role: Role;
};

type Props = {
  boardId: string;
  isOwner: boolean;
  collaborators: Collaborator[];
  shareToken: string | null;
  siteUrl: string;
  labels: LabelModel[];
};

export function BoardSettings({
  boardId,
  isOwner,
  collaborators,
  shareToken,
  siteUrl,
  labels,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isOwner) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Board settings"
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
      >
        <Settings size={16} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 max-h-[80vh] w-[24rem] overflow-y-auto rounded-md border border-border bg-bg-elevated p-4 shadow-lg">
          <SharePanel boardId={boardId} shareToken={shareToken} siteUrl={siteUrl} />
          <div className="my-4 h-px bg-border" />
          <CollaboratorsPanel boardId={boardId} initial={collaborators} />
          <div className="my-4 h-px bg-border" />
          <LabelsPanel boardId={boardId} initial={labels} />
        </div>
      )}
    </div>
  );
}

function SharePanel({
  boardId,
  shareToken,
  siteUrl,
}: {
  boardId: string;
  shareToken: string | null;
  siteUrl: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(shareToken);
  const [pending, setPending] = useState<'rotate' | 'revoke' | null>(null);
  const [copied, setCopied] = useState(false);

  const url = token ? `${siteUrl}/s/${boardId}?t=${token}` : null;

  async function handleRotate() {
    setPending('rotate');
    const r = await rotateShareToken(boardId);
    if (r.ok) {
      setToken(r.data.token);
      router.refresh();
    }
    setPending(null);
  }

  async function handleRevoke() {
    setPending('revoke');
    const r = await revokeShareToken(boardId);
    if (r.ok) {
      setToken(null);
      router.refresh();
    }
    setPending(null);
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <Link2 size={14} strokeWidth={1.5} aria-hidden className="text-text-muted" />
        <h3 className="text-sm font-semibold">Public read-only link</h3>
      </header>
      {url ? (
        <>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="flex-1 truncate text-xs" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              aria-label="Copy link"
            >
              {copied ? (
                <Check size={14} strokeWidth={1.5} aria-hidden />
              ) : (
                <Copy size={14} strokeWidth={1.5} aria-hidden />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Anyone with this link can view (not edit) the board.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRotate}
              disabled={pending !== null}
            >
              {pending === 'rotate' ? (
                <Loader2 size={12} strokeWidth={1.5} className="animate-spin" aria-hidden />
              ) : null}
              Rotate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRevoke}
              disabled={pending !== null}
              className="text-danger"
            >
              {pending === 'revoke' ? (
                <Loader2 size={12} strokeWidth={1.5} className="animate-spin" aria-hidden />
              ) : null}
              Revoke
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" size="sm" onClick={handleRotate} disabled={pending !== null}>
          {pending === 'rotate' ? (
            <Loader2 size={12} strokeWidth={1.5} className="animate-spin" aria-hidden />
          ) : null}
          Generate share link
        </Button>
      )}
    </section>
  );
}

function CollaboratorsPanel({
  boardId,
  initial,
}: {
  boardId: string;
  initial: Collaborator[];
}) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await inviteCollaborator(boardId, email, role);
      if (!r.ok) setError(r.error);
      else {
        setEmail('');
        router.refresh();
      }
    });
  }

  function handleRoleChange(profileId: string, next: Role) {
    const original = list.find((c) => c.profile_id === profileId);
    setList((prev) => prev.map((c) => (c.profile_id === profileId ? { ...c, role: next } : c)));
    startTransition(async () => {
      const r = await updateCollaboratorRole(boardId, profileId, next);
      if (!r.ok && original) {
        setList((prev) => prev.map((c) => (c.profile_id === profileId ? original : c)));
      }
    });
  }

  function handleRemove(profileId: string) {
    const original = list;
    setList((prev) => prev.filter((c) => c.profile_id !== profileId));
    startTransition(async () => {
      const r = await removeCollaborator(boardId, profileId);
      if (!r.ok) setList(original);
      else router.refresh();
    });
  }

  return (
    <section>
      <header className="mb-2">
        <h3 className="text-sm font-semibold">Collaborators</h3>
      </header>
      <form onSubmit={handleInvite} className="flex items-center gap-2">
        <Input
          type="email"
          required
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="flex-1 text-xs"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={submitting}
          className="h-9 rounded-sm border border-border bg-bg px-2 text-xs"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit" size="sm" disabled={submitting}>
          Invite
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      {list.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {list.map((c) => (
            <li
              key={c.profile_id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-sm bg-surface/40 px-2 py-1.5',
              )}
            >
              <span className="truncate text-xs">{c.display_name}</span>
              <div className="flex items-center gap-1">
                <select
                  value={c.role}
                  onChange={(e) => handleRoleChange(c.profile_id, e.target.value as Role)}
                  className="h-7 rounded-sm border border-border bg-bg px-1 text-xs"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${c.display_name}`}
                  onClick={() => handleRemove(c.profile_id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-bg hover:text-danger"
                >
                  <Trash2 size={12} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-muted">No collaborators yet.</p>
      )}
    </section>
  );
}

function LabelsPanel({ boardId, initial }: { boardId: string; initial: LabelModel[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [, startTransition] = useTransition();

  // Keep the panel in sync if realtime / router.refresh hand us a new list.
  useEffect(() => {
    setList(initial);
  }, [initial]);

  function handleRename(labelId: string, name: string) {
    const original = list.find((l) => l.id === labelId);
    if (!original || original.name === name) return;
    setList((prev) => prev.map((l) => (l.id === labelId ? { ...l, name } : l)));
    startTransition(async () => {
      const r = await updateLabel(boardId, labelId, { name });
      if (!r.ok && original) {
        setList((prev) => prev.map((l) => (l.id === labelId ? original : l)));
      } else {
        router.refresh();
      }
    });
  }

  function handleRecolor(labelId: string, color: SwatchColor) {
    const original = list.find((l) => l.id === labelId);
    if (!original || original.color === color) return;
    setList((prev) => prev.map((l) => (l.id === labelId ? { ...l, color } : l)));
    startTransition(async () => {
      const r = await updateLabel(boardId, labelId, { color });
      if (!r.ok && original) {
        setList((prev) => prev.map((l) => (l.id === labelId ? original : l)));
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete(labelId: string) {
    const original = list;
    setList((prev) => prev.filter((l) => l.id !== labelId));
    startTransition(async () => {
      const r = await deleteLabel(boardId, labelId);
      if (!r.ok) setList(original);
      else router.refresh();
    });
  }

  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <Tag size={14} strokeWidth={1.5} aria-hidden className="text-text-muted" />
        <h3 className="text-sm font-semibold">Labels</h3>
      </header>
      {list.length === 0 ? (
        <p className="text-xs text-text-muted">
          No labels yet. Create one from the card editor's label picker.
        </p>
      ) : (
        <ul className="space-y-1">
          {list.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              onRename={(name) => handleRename(label.id, name)}
              onRecolor={(color) => handleRecolor(label.id, color)}
              onDelete={() => handleDelete(label.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function LabelRow({
  label,
  onRename,
  onRecolor,
  onDelete,
}: {
  label: LabelModel;
  onRename: (name: string) => void;
  onRecolor: (color: SwatchColor) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [confirming, setConfirming] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(label.name);
  }, [label.name]);

  useEffect(() => {
    if (!paletteOpen) return;
    function onDown(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [paletteOpen]);

  return (
    <li className="flex items-center gap-2 rounded-sm bg-surface/40 px-2 py-1.5">
      <div className="relative" ref={paletteRef}>
        <button
          type="button"
          aria-label="Change color"
          onClick={() => setPaletteOpen((v) => !v)}
          className={cn('h-4 w-4 rounded-sm', swatchClass(label.color))}
        />
        {paletteOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 flex w-44 flex-wrap gap-1 rounded-md border border-border bg-bg-elevated p-2 shadow-md">
            {SWATCH_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => {
                  onRecolor(c);
                  setPaletteOpen(false);
                }}
                className={cn(
                  'h-5 w-5 rounded-sm',
                  swatchClass(c),
                  label.color === c && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-elevated',
                )}
              />
            ))}
          </div>
        )}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onRename(name.trim() || label.name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setName(label.name);
            e.currentTarget.blur();
          }
        }}
        maxLength={40}
        className="flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-xs focus-visible:border-accent focus-visible:bg-bg focus-visible:outline-none"
      />
      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-sm bg-danger px-2 py-0.5 text-[10px] font-medium text-white"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-sm px-2 py-0.5 text-[10px] text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Delete label ${label.name}`}
          onClick={() => setConfirming(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-bg hover:text-danger"
        >
          <Trash2 size={12} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </li>
  );
}
