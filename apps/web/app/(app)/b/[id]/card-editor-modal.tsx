'use client';

import { useCoarsePointer } from '@/lib/use-media-query';
import { cn } from '@kpu/ui';
import {
  AnimatePresence,
  type PanInfo,
  motion,
  useDragControls,
  useReducedMotion,
} from 'framer-motion';
import { Camera, Check, ImageOff, Loader2, Tag, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  attachLabel,
  createLabel,
  detachLabel,
  recordImage,
  renameCard,
  setCardCoverImage,
  updateCardBody,
} from './actions';
import { CardLabelChips } from './card-label-chips';
import { CoverImage } from './cover-image';
import { LabelPicker } from './label-picker';
import { PeerEditingBanner } from './peer-editing-banner';
import { setLocalViewingCardId } from './presence-bus';
import type { ImageModel, LabelModel } from './types';

// The Tiptap stack (~140 kB of JS) is the bulk of the modal route's
// First Load JS. Defer it until the modal actually mounts so /b/[id]
// stays light when the user isn't editing a card.
const TiptapEditor = dynamic(
  () => import('./tiptap-editor').then((m) => ({ default: m.TiptapEditor })),
  {
    ssr: false,
    loading: () => <div className="min-h-[12rem]" aria-hidden />,
  },
);

const MODAL_SPRING = { type: 'spring' as const, stiffness: 220, damping: 28 };

type CardForModal = {
  id: string;
  board_id: string;
  title: string;
  body_md: string;
  cover_image_id: string | null;
  row_id: string;
  column_id: string;
};

type Props = {
  boardId: string;
  card: CardForModal;
  labels: LabelModel[];
  cardLabelIds: string[];
  images: ImageModel[];
  selfId: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function CardEditorModal({
  boardId,
  card,
  labels: initialLabels,
  cardLabelIds: initialCardLabelIds,
  images: initialImages,
  selfId,
}: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body_md);
  const [labels, setLabels] = useState<LabelModel[]>(initialLabels);
  const [cardLabelIds, setCardLabelIds] = useState<string[]>(initialCardLabelIds);
  const [images, setImages] = useState<ImageModel[]>(initialImages);
  const [coverImageId, setCoverImageId] = useState<string | null>(card.cover_image_id);
  const [bodySave, setBodySave] = useState<SaveState>('idle');
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  // ─── Close behavior ─────────────────────────────────────────────────────
  // Trigger the exit animation first, then route back when it finishes.
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const handleExitComplete = useCallback(() => {
    router.push(`/b/${boardId}`, { scroll: false });
  }, [router, boardId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // Prevent background scroll while modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Tell the presence bus which card we're editing so peers can see it.
  useEffect(() => {
    setLocalViewingCardId(card.id);
    return () => {
      setLocalViewingCardId(null);
    };
  }, [card.id]);

  // ─── Title save (on blur) ───────────────────────────────────────────────
  async function handleTitleBlur() {
    const next = title.trim();
    if (!next || next === card.title) {
      setTitle(card.title);
      return;
    }
    const result = await renameCard(boardId, card.id, next);
    if (!result.ok) setTitle(card.title);
    else router.refresh();
  }

  // ─── Body auto-save (600 ms debounce) ───────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(card.body_md);
  const insertImageRef = useRef<((file: File) => Promise<void>) | null>(null);

  const scheduleBodySave = useCallback(
    (next: string) => {
      setBody(next);
      if (next === lastSavedRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setBodySave('saving');
      debounceRef.current = setTimeout(async () => {
        const result = await updateCardBody(boardId, card.id, next);
        if (result.ok) {
          lastSavedRef.current = next;
          setBodySave('saved');
          if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = setTimeout(() => setBodySave('idle'), 1200);
        } else {
          setBodySave('error');
        }
      }, 600);
    },
    [boardId, card.id],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  // Flush a pending save on close.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        if (body !== lastSavedRef.current) {
          void updateCardBody(boardId, card.id, body);
        }
      }
    };
  }, [body, boardId, card.id]);

  // ─── Labels ─────────────────────────────────────────────────────────────
  async function handleToggleLabel(labelId: string) {
    const attached = cardLabelIds.includes(labelId);
    if (attached) {
      setCardLabelIds((prev) => prev.filter((id) => id !== labelId));
      const r = await detachLabel(boardId, card.id, labelId);
      if (!r.ok) setCardLabelIds((prev) => [...prev, labelId]);
      else router.refresh();
    } else {
      setCardLabelIds((prev) => [...prev, labelId]);
      const r = await attachLabel(boardId, card.id, labelId);
      if (!r.ok) setCardLabelIds((prev) => prev.filter((id) => id !== labelId));
      else router.refresh();
    }
  }

  async function handleCreateLabel(name: string, color: string) {
    const r = await createLabel(boardId, name, color);
    if (r.ok) {
      setLabels((prev) => [...prev, { id: r.data.id, board_id: boardId, name, color }]);
      router.refresh();
    }
  }

  // ─── Image upload → Storage → blurhash → images row ─────────────────────
  const [uploadStatus, setUploadStatus] = useState<
    { state: 'idle' } | { state: 'uploading' } | { state: 'error'; message: string }
  >({ state: 'idle' });

  const handleImageUpload = useCallback(
    async (file: File): Promise<{ id: string; storagePath: string } | null> => {
      try {
        setUploadStatus({ state: 'uploading' });
        const { uploadCardImage } = await import('./upload-card-image');
        const uploaded = await uploadCardImage({
          file,
          boardId,
          cardId: card.id,
        });
        if (!uploaded.ok) {
          setUploadStatus({ state: 'error', message: uploaded.error });
          return null;
        }
        const recorded = await recordImage({
          boardId,
          cardId: card.id,
          storagePath: uploaded.storagePath,
          width: uploaded.width,
          height: uploaded.height,
          mime: uploaded.mime,
          blurhash: uploaded.blurhash,
        });
        if (!recorded.ok) {
          setUploadStatus({ state: 'error', message: recorded.error });
          return null;
        }
        setImages((prev) => [
          ...prev,
          {
            id: recorded.data.id,
            board_id: boardId,
            card_id: card.id,
            storage_path: uploaded.storagePath,
            width: uploaded.width,
            height: uploaded.height,
            mime: uploaded.mime,
            blurhash: uploaded.blurhash,
          },
        ]);
        setUploadStatus({ state: 'idle' });
        return { id: recorded.data.id, storagePath: uploaded.storagePath };
      } catch (err) {
        setUploadStatus({
          state: 'error',
          message: err instanceof Error ? err.message : 'Upload failed.',
        });
        return null;
      }
    },
    [boardId, card.id],
  );

  // ─── Cover image ────────────────────────────────────────────────────────
  async function handleSetCover(imageId: string | null) {
    setCoverImageId(imageId);
    const r = await setCardCoverImage(boardId, card.id, imageId);
    if (!r.ok) setCoverImageId(card.cover_image_id);
    else router.refresh();
  }

  const coverImage = useMemo(
    () => images.find((i) => i.id === coverImageId) ?? null,
    [images, coverImageId],
  );
  const cardImages = useMemo(() => images.filter((i) => i.card_id === card.id), [images, card.id]);

  const attachedLabels = useMemo(
    () => labels.filter((l) => cardLabelIds.includes(l.id)),
    [labels, cardLabelIds],
  );

  // ─── Motion variants ────────────────────────────────────────────────────
  // Reduced motion → instant; otherwise spring in/out. The dialog variant
  // fades + scales from the center; the sheet variant slides up from the
  // bottom of the viewport on coarse pointers (touch).
  const backdrop = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };
  const dialog = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1 } };
  const sheet = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { y: '100%' }, visible: { y: 0 } };

  const isSheet = coarse;
  const surfaceShell = isSheet
    ? 'fixed inset-x-0 bottom-0 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-bg-elevated shadow-xl'
    : 'relative w-full max-w-3xl rounded-lg border border-border bg-bg-elevated shadow-lg';

  const transition = reduce ? { duration: 0 } : MODAL_SPRING;

  // Drag-to-dismiss (sheet only, motion-allowed only). The body of the sheet
  // scrolls vertically; we don't want every scroll gesture to drag the sheet,
  // so we gate the listener on a `useDragControls` instance that we only start
  // from the sticky drag-handle row.
  const dragControls = useDragControls();
  const dragEnabled = isSheet && !reduce;
  const handleDragEnd = useCallback(
    (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      if (info.offset.y > 120 || info.velocity.y > 500) close();
    },
    [close],
  );

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open && (
        <motion.div
          key="card-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Card editor"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={reduce ? { duration: 0 } : { duration: 0.18 }}
          className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
            isSheet
              ? 'flex items-end justify-center'
              : 'flex items-start justify-center overflow-y-auto px-4 py-12',
          )}
        >
          <button
            type="button"
            aria-label="Close backdrop"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 cursor-default"
          />
          <motion.div
            variants={isSheet ? sheet : dialog}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transition}
            className={surfaceShell}
            drag={dragEnabled ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={dragEnabled ? handleDragEnd : undefined}
          >
            {/* Sheet drag handle + sticky close (touch) */}
            {isSheet && (
              <div
                onPointerDown={(e) => {
                  if (dragEnabled) dragControls.start(e);
                }}
                className="sticky top-0 z-20 flex items-center justify-center bg-bg-elevated/95 pb-1 pt-2 backdrop-blur-sm touch-none"
                style={{ cursor: dragEnabled ? 'grab' : undefined }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag to dismiss"
                  className="h-1 w-10 rounded-full bg-border"
                />
                <button
                  type="button"
                  aria-label="Close"
                  onClick={close}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute right-3 top-2 inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            )}
            {/* Cover image */}
            {coverImage ? (
              <CoverImage
                image={coverImage}
                className={cn('h-40 w-full object-cover', isSheet ? '' : 'rounded-t-lg')}
              />
            ) : null}

            {!isSheet && (
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-sm bg-bg-elevated/90 text-text-muted hover:bg-surface hover:text-text"
              >
                <X size={16} strokeWidth={1.5} aria-hidden />
              </button>
            )}

            <div className="space-y-4 p-6">
              <PeerEditingBanner cardId={card.id} selfId={selfId} />

              {/* Title */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                maxLength={200}
                placeholder="Untitled"
                className="w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-xl font-semibold focus-visible:border-accent focus-visible:bg-bg focus-visible:outline-none"
              />

              {/* Attached labels */}
              {attachedLabels.length > 0 && (
                <CardLabelChips labels={attachedLabels} onRemove={(id) => handleToggleLabel(id)} />
              )}

              {/* Toolbar row */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLabelPicker((v) => !v)}
                    className="inline-flex h-8 items-center gap-1 rounded-sm border border-border bg-bg px-2 text-xs text-text-muted hover:bg-surface hover:text-text"
                  >
                    <Tag size={14} strokeWidth={1.5} aria-hidden />
                    Labels
                  </button>
                  {showLabelPicker && (
                    <LabelPicker
                      allLabels={labels}
                      selectedIds={cardLabelIds}
                      onToggle={handleToggleLabel}
                      onCreate={handleCreateLabel}
                      onClose={() => setShowLabelPicker(false)}
                    />
                  )}
                </div>

                <CoverImagePicker
                  images={cardImages}
                  currentId={coverImageId}
                  onChange={handleSetCover}
                />

                <AddPhotoButton
                  disabled={uploadStatus.state === 'uploading'}
                  onPick={async (file) => {
                    const insert = insertImageRef.current;
                    if (insert) {
                      await insert(file);
                    } else {
                      // Fallback: editor not mounted yet — just upload so the
                      // image lands in the gallery and can be set as cover.
                      await handleImageUpload(file);
                    }
                  }}
                />

                <div className="ml-auto flex items-center gap-2 text-xs text-text-muted">
                  <SaveStatus state={bodySave} />
                </div>
              </div>

              {/* Tiptap editor */}
              <div className="rounded-md border border-border bg-bg">
                <TiptapEditor
                  initialMarkdown={card.body_md}
                  onChangeMarkdown={scheduleBodySave}
                  registerInsertImage={(fn) => {
                    insertImageRef.current = fn;
                  }}
                  onImageDropped={async (file) => {
                    const r = await handleImageUpload(file);
                    if (!r) return null;
                    // Return a signed URL for the editor to render.
                    const { getSignedImageUrl } = await import('./actions');
                    const signed = await getSignedImageUrl(r.storagePath);
                    if (signed.ok) return signed.data.url;
                    return null;
                  }}
                />
              </div>

              {uploadStatus.state === 'uploading' && (
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden />
                  Uploading image…
                </p>
              )}
              {uploadStatus.state === 'error' && (
                <p className="flex items-center gap-2 text-xs text-danger">
                  <ImageOff size={14} strokeWidth={1.5} aria-hidden />
                  {uploadStatus.message}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400',
          'motion-safe:animate-in motion-safe:fade-in',
        )}
      >
        <Check size={12} strokeWidth={1.5} aria-hidden />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return <span className="text-danger">Save failed</span>;
  }
  return null;
}

function AddPhotoButton({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (file: File) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { pickPhoto } = await import('@/lib/camera');
          const file = await pickPhoto('prompt');
          if (file) await onPick(file);
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-8 items-center gap-1 rounded-sm border border-border bg-bg px-2 text-xs text-text-muted hover:bg-surface hover:text-text disabled:opacity-50"
      title="Add a photo (camera on mobile, file picker on web)"
    >
      <Camera size={14} strokeWidth={1.5} aria-hidden />
      Photo
    </button>
  );
}

function CoverImagePicker({
  images,
  currentId,
  onChange,
}: {
  images: ImageModel[];
  currentId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={images.length === 0}
        className="inline-flex h-8 items-center gap-1 rounded-sm border border-border bg-bg px-2 text-xs text-text-muted hover:bg-surface hover:text-text disabled:opacity-50"
        title={images.length === 0 ? 'Upload an image first' : 'Choose cover image'}
      >
        Cover
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-border bg-bg-elevated p-2 shadow-md">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs hover:bg-surface',
              currentId === null && 'font-medium text-accent',
            )}
          >
            <span>No cover</span>
            {currentId === null && <Check size={12} strokeWidth={1.5} aria-hidden />}
          </button>
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                onChange(img.id);
                setOpen(false);
              }}
              className={cn(
                'mt-1 flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs hover:bg-surface',
                currentId === img.id && 'font-medium text-accent',
              )}
            >
              <span className="truncate">{img.storage_path.split('/').pop()}</span>
              {currentId === img.id && <Check size={12} strokeWidth={1.5} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
