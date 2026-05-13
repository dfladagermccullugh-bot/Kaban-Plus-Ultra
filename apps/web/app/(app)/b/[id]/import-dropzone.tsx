'use client';

import { ZipDropzone } from '@/components/zip-dropzone';
import { useRouter } from 'next/navigation';
import { mergeBoardFromZip } from './import-actions';

export function ImportDropzone({ boardId }: { boardId: string }) {
  const router = useRouter();

  async function onFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const result = await mergeBoardFromZip(boardId, fd);
    if (!result.ok) return { ok: false as const, error: result.error };
    router.refresh();
    const { rowsCreated, columnsCreated, cardsCreated } = result.counts;
    const newBits: string[] = [];
    if (rowsCreated) newBits.push(`${rowsCreated} new row${rowsCreated === 1 ? '' : 's'}`);
    if (columnsCreated) {
      newBits.push(`${columnsCreated} new column${columnsCreated === 1 ? '' : 's'}`);
    }
    const suffix = newBits.length > 0 ? ` (+ ${newBits.join(', ')})` : '';
    return {
      ok: true as const,
      message: `Merged ${cardsCreated} card${cardsCreated === 1 ? '' : 's'}${suffix}.`,
    };
  }

  return (
    <ZipDropzone
      title="Drop a .zip to merge into this board"
      hint="Rows / columns / labels are matched by title; new ones are appended."
      onFile={onFile}
    />
  );
}
