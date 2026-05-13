'use client';

import { ZipDropzone } from '@/components/zip-dropzone';
import { useRouter } from 'next/navigation';
import { importBoardFromZip } from './import-actions';

export function ImportDropzone() {
  const router = useRouter();

  async function onFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const result = await importBoardFromZip(fd);
    if (!result.ok) return { ok: false as const, error: result.error };
    router.push(`/b/${result.boardId}`);
    router.refresh();
    const { rows, columns, cards } = result.counts;
    return {
      ok: true as const,
      message: `Imported ${cards} card${cards === 1 ? '' : 's'} into ${rows} row${
        rows === 1 ? '' : 's'
      } × ${columns} column${columns === 1 ? '' : 's'}.`,
    };
  }

  return (
    <ZipDropzone
      title="Drop a .zip to import a new board"
      hint="Use an archive produced by the export button."
      onFile={onFile}
    />
  );
}
