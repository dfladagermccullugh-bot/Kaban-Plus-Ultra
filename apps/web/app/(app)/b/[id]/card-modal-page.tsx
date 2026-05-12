import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CardEditorModal } from './card-editor-modal';

type Params = { params: Promise<{ id: string; cardId: string }> };

export async function CardModalPage({ params }: Params) {
  const { id: boardId, cardId } = await params;
  const supabase = await createClient();

  const [{ data: card }, { data: labels }, { data: cardLabelRows }, { data: cover }] =
    await Promise.all([
      supabase
        .from('cards')
        .select('id, board_id, title, body_md, cover_image_id, row_id, column_id')
        .eq('id', cardId)
        .eq('board_id', boardId)
        .maybeSingle(),
      supabase.from('labels').select('id, board_id, name, color').eq('board_id', boardId),
      supabase.from('card_labels').select('card_id, label_id').eq('card_id', cardId),
      supabase
        .from('images')
        .select('id, board_id, card_id, storage_path, width, height, mime, blurhash')
        .eq('board_id', boardId),
    ]);

  if (!card) notFound();

  return (
    <CardEditorModal
      boardId={boardId}
      card={card}
      labels={labels ?? []}
      cardLabelIds={(cardLabelRows ?? []).map((r) => r.label_id)}
      images={cover ?? []}
    />
  );
}
