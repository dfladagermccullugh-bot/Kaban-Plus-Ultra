import { createClient } from '@/lib/supabase/browser';
import { encode } from 'blurhash';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type UploadInput = {
  file: File;
  boardId: string;
  cardId: string;
};

export type UploadResult =
  | {
      ok: true;
      storagePath: string;
      width: number;
      height: number;
      mime: string;
      blurhash: string;
    }
  | { ok: false; error: string };

/**
 * Upload a card image to Supabase Storage and compute a blurhash on the client.
 * The server action `recordImage` should be invoked afterwards to persist the
 * matching row in `public.images`.
 *
 * Defensive against the `card-images` bucket not yet being provisioned — a
 * "Bucket not found" error is surfaced verbatim so the UI can show a helpful
 * inline message instead of crashing the modal.
 */
export async function uploadCardImage({
  file,
  boardId,
  cardId,
}: UploadInput): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: `Unsupported image type: ${file.type || 'unknown'}.` };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Image must be 10 MB or less.' };
  }

  const dims = await readImageDimensions(file);
  if (!dims) return { ok: false, error: 'Could not read image.' };
  if (dims.width > 8192 || dims.height > 8192) {
    return { ok: false, error: 'Image dimensions must be 8192×8192 or less.' };
  }

  const blurhash = await computeBlurhash(file, dims.width, dims.height);

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  const safeExt = ext.replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin';
  const storagePath = `${boardId}/${cardId}/${crypto.randomUUID()}.${safeExt}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from('card-images')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    storagePath,
    width: dims.width,
    height: dims.height,
    mime: file.type,
    blurhash,
  };
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

const BLURHASH_X = 4;
const BLURHASH_Y = 3;
const BLURHASH_MAX_DIM = 64;

async function computeBlurhash(file: File, width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, BLURHASH_MAX_DIM / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to a neutral blurhash if 2d context is unavailable.
        resolve('L00000fQfQfQfQfQfQfQfQfQfQfQ');
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      try {
        const hash = encode(data.data, w, h, BLURHASH_X, BLURHASH_Y);
        resolve(hash);
      } catch {
        resolve('L00000fQfQfQfQfQfQfQfQfQfQfQ');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('L00000fQfQfQfQfQfQfQfQfQfQfQ');
    };
    img.src = url;
  });
}
