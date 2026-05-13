'use client';

import { FileArchive, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

/**
 * Full-viewport drag-drop target for `.zip` archives. Mounts a window-
 * level listener so the drop target is the entire page; only renders
 * the overlay while a file is being dragged or while a result is
 * pending. The dropped file is handed to `onFile`; the caller posts
 * it to a server action and returns a status string.
 */
export function ZipDropzone({
  title,
  hint,
  onFile,
}: {
  title: string;
  hint?: string;
  onFile: (file: File) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
}) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const dragDepth = useRef(0);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isZip(file)) {
        setStatus({ kind: 'error', message: 'Only .zip files are supported.' });
        return;
      }
      setStatus({ kind: 'uploading' });
      const result = await onFile(file);
      if (result.ok) setStatus({ kind: 'success', message: result.message });
      else setStatus({ kind: 'error', message: result.error });
    },
    [onFile],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function hasFiles(e: DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes('Files');
    }
    // Don't steal drops aimed at a Tiptap editor (card image paste/drop)
    // or any other contenteditable surface. Those handlers do their own
    // upload via `onImageDropped`.
    function isEditorTarget(target: EventTarget | null) {
      const el = target as Element | null;
      return Boolean(el?.closest?.('[contenteditable="true"], .ProseMirror'));
    }
    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e) || isEditorTarget(e.target)) return;
      dragDepth.current += 1;
      setDragging(true);
    }
    function onDragOver(e: DragEvent) {
      if (!hasFiles(e) || isEditorTarget(e.target)) return;
      e.preventDefault();
    }
    function onDragLeave(e: DragEvent) {
      if (!hasFiles(e) || isEditorTarget(e.target)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      if (!hasFiles(e) || isEditorTarget(e.target)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  const overlayVisible = dragging || status.kind !== 'idle';
  if (!overlayVisible) return null;

  const borderClass = status.kind === 'error' ? 'border-danger' : 'border-accent';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm"
    >
      <div
        className={`pointer-events-auto flex max-w-md flex-col items-center gap-3 rounded-md border-2 border-dashed bg-bg-elevated p-8 text-center shadow-xl ${borderClass}`}
      >
        <Body status={status} title={title} hint={hint} />
        {status.kind === 'success' || status.kind === 'error' ? (
          <button
            type="button"
            onClick={() => setStatus({ kind: 'idle' })}
            className="mt-2 inline-flex h-9 items-center rounded-sm border border-border px-3 text-sm hover:bg-surface"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Body({ status, title, hint }: { status: Status; title: string; hint?: string }) {
  if (status.kind === 'uploading') {
    return (
      <>
        <Loader2 size={32} strokeWidth={1.5} className="animate-spin text-accent" aria-hidden />
        <p className="text-sm font-medium">Importing…</p>
      </>
    );
  }
  if (status.kind === 'success') {
    return (
      <>
        <FileArchive size={32} strokeWidth={1.5} className="text-accent" aria-hidden />
        <p className="text-sm font-medium">{status.message}</p>
      </>
    );
  }
  if (status.kind === 'error') {
    return (
      <>
        <FileArchive size={32} strokeWidth={1.5} className="text-danger" aria-hidden />
        <p className="text-sm font-medium text-danger" role="alert">
          {status.message}
        </p>
      </>
    );
  }
  return (
    <>
      <FileArchive size={32} strokeWidth={1.5} className="text-accent" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </>
  );
}

function isZip(file: File): boolean {
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return true;
  return file.name.toLowerCase().endsWith('.zip');
}
