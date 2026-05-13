'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Header button that pulls a `.zip` of markdown files from the board's
 * `/export` route handler. Available to any user with viewer+ access (the
 * route itself is RLS-gated). Owner-only "Share / Collaborators / Labels"
 * stay in `BoardSettings`.
 *
 * We download via `fetch + blob URL` rather than `window.open(href)` so we
 * can show a spinner during the (possibly multi-second) zip build, surface
 * errors inline, and never lose the parent route.
 */
export function ExportButton({ boardId }: { boardId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/b/${boardId}/export`, { method: 'GET' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const filename = parseFilename(res.headers.get('content-disposition')) ?? 'board.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        aria-label="Export board as Markdown zip"
        title="Export board as Markdown zip"
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" aria-hidden />
        ) : (
          <Download size={16} strokeWidth={1.5} aria-hidden />
        )}
      </button>
      {error ? (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-bg-elevated p-2 text-right text-xs text-danger shadow-md"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}
