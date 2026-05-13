/**
 * Cross-platform "pick a photo" helper.
 *
 * - On native (Capacitor): opens the OS picker via `@capacitor/camera`,
 *   which lets the user choose between the camera and their photo
 *   library. Returns the captured image as a `File` so it flows through
 *   the existing `uploadCardImage` pipeline unchanged.
 * - On web: falls back to a hidden `<input type="file" accept="image/*">`
 *   appended to the document. Mobile browsers also surface the OS camera
 *   from that input (via the `capture` attribute).
 *
 * Returns `null` if the user cancels.
 */
import { Capacitor } from '@capacitor/core';

type PickSource = 'prompt' | 'camera' | 'library';

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export async function pickPhoto(source: PickSource = 'prompt'): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    return pickNative(source);
  }
  return pickWeb(source);
}

async function pickNative(source: PickSource): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const cameraSource =
    source === 'camera'
      ? CameraSource.Camera
      : source === 'library'
        ? CameraSource.Photos
        : CameraSource.Prompt;
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: cameraSource,
      saveToGallery: false,
    });
    if (!photo.dataUrl) return null;
    const blob = await dataUrlToBlob(photo.dataUrl);
    const format = (photo.format ?? 'jpeg').toLowerCase();
    const mime = MIME_BY_FORMAT[format] ?? blob.type ?? 'image/jpeg';
    const name = `capture-${Date.now()}.${format === 'jpg' ? 'jpeg' : format}`;
    return new File([blob], name, { type: mime });
  } catch (err) {
    // The Camera plugin throws when the user cancels.
    if (isCancelled(err)) return null;
    throw err;
  }
}

function pickWeb(source: PickSource): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source !== 'library') {
      // Hints to mobile browsers that the OS camera is preferred.
      input.setAttribute('capture', 'environment');
    }
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
      window.removeEventListener('focus', onFocus);
    };
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    // The native dialog may close without firing `change` if the user
    // cancels. We treat the next window focus + no file as a cancel.
    function onFocus() {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) finish(null);
      }, 250);
    }

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null);
    });
    window.addEventListener('focus', onFocus, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function isCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as { message?: string }).message?.toLowerCase() ?? '';
  return msg.includes('cancel') || msg.includes('user denied') || msg.includes('no image picked');
}

export function isNativeCameraAvailable(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}
