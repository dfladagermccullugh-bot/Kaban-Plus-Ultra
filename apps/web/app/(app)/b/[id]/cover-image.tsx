'use client';

import { cn } from '@kpu/ui';
import { decode } from 'blurhash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSignedImageUrl } from './actions';
import type { ImageModel } from './types';

type Props = {
  image: ImageModel;
  className?: string;
  /** When true, render a small thumbnail strip (for use on card front). */
  thumbnail?: boolean;
};

export function CoverImage({ image, className, thumbnail = false }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const blurDataUrl = useMemo(() => blurhashToDataUrl(image.blurhash), [image.blurhash]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setErrored(false);
    void (async () => {
      const r = await getSignedImageUrl(image.storage_path);
      if (cancelled) return;
      if (r.ok) setSignedUrl(r.data.url);
      else setErrored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [image.storage_path]);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-surface',
        thumbnail ? 'h-12 w-full rounded-t-md' : '',
        className,
      )}
      style={{
        aspectRatio: thumbnail ? undefined : `${image.width} / ${image.height}`,
      }}
    >
      {blurDataUrl && !loaded && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {signedUrl && !errored && (
        <img
          src={signedUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}

const BLURHASH_DECODE_SIZE = 32;

function blurhashToDataUrl(hash: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!hash || hash.length < 6) return null;
  try {
    const pixels = decode(hash, BLURHASH_DECODE_SIZE, BLURHASH_DECODE_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = BLURHASH_DECODE_SIZE;
    canvas.height = BLURHASH_DECODE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.createImageData(BLURHASH_DECODE_SIZE, BLURHASH_DECODE_SIZE);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
