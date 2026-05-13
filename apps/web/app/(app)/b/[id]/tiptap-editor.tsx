'use client';

import { Image as TiptapImage } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { Markdown } from 'tiptap-markdown';

type Props = {
  initialMarkdown: string;
  onChangeMarkdown: (next: string) => void;
  /**
   * Called when the user drops/pastes an image. Should upload it and return
   * the URL to embed, or `null` if the upload failed.
   */
  onImageDropped?: (file: File) => Promise<string | null>;
  /**
   * Registers an imperative `insert(file)` handle with the parent so it can
   * push an image into the document from outside (e.g. a "Photo" button).
   * The registered function reuses the same `onImageDropped` upload path.
   */
  registerInsertImage?: (fn: ((file: File) => Promise<void>) | null) => void;
};

export function TiptapEditor({
  initialMarkdown,
  onChangeMarkdown,
  onImageDropped,
  registerInsertImage,
}: Props) {
  const onImageDroppedRef = useRef(onImageDropped);
  onImageDroppedRef.current = onImageDropped;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: 'rounded-sm bg-surface' } } }),
      Markdown.configure({ html: false, tightLists: true, linkify: true, breaks: false }),
      Placeholder.configure({ placeholder: 'Write something…' }),
      TiptapImage.configure({ inline: false, allowBase64: false }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[12rem] px-4 py-3 focus:outline-none',
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            void handleFile(file);
            return true;
          }
        }
        return false;
      },
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        for (const file of imageFiles) void handleFile(file);
        return true;
      },
    },
    onUpdate({ editor: ed }) {
      // tiptap-markdown attaches a `storage.markdown.getMarkdown()` helper.
      const md = ed.storage.markdown.getMarkdown() as string;
      onChangeMarkdown(md);
    },
  });

  async function handleFile(file: File) {
    const url = await onImageDroppedRef.current?.(file);
    if (!url || !editor) return;
    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  }

  // Expose the file → upload → insert flow to the parent so an external
  // button (e.g. the "Photo" toolbar button) can insert an image without
  // going through a drop/paste event. Inlined here so biome's exhaustive-
  // deps rule sees a stable, self-contained closure.
  useEffect(() => {
    if (!registerInsertImage) return;
    if (!editor) return;
    const insert = async (file: File) => {
      const url = await onImageDroppedRef.current?.(file);
      if (!url) return;
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    };
    registerInsertImage(insert);
    return () => registerInsertImage(null);
  }, [editor, registerInsertImage]);

  // Reset content when switching cards.
  useEffect(() => {
    if (!editor) return;
    const current = editor.storage.markdown?.getMarkdown?.();
    if (current === initialMarkdown) return;
    editor.commands.setContent(initialMarkdown, false);
  }, [editor, initialMarkdown]);

  if (!editor) return <div className="min-h-[12rem]" />;
  return <EditorContent editor={editor} />;
}
