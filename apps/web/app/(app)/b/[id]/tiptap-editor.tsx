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
};

export function TiptapEditor({ initialMarkdown, onChangeMarkdown, onImageDropped }: Props) {
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
