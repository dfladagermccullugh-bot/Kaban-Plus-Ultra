import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { getSiteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { sortByPosition } from '@kpu/core';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardSettings, type Collaborator } from './board-settings';
import { BoardView } from './board-view';
import { PresenceAvatars } from './presence-avatars';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function BoardPage({ params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/b/${id}`);

  const supabase = await createClient();
  const [
    { data: board },
    { data: rows },
    { data: columns },
    { data: cards },
    { data: labels },
    { data: cardLabels },
    { data: coverImages },
  ] = await Promise.all([
    supabase
      .from('boards')
      .select('id, title, cover_color, owner_id, share_token')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('rows')
      .select('id, board_id, title, color, position, collapsed')
      .eq('board_id', id),
    supabase
      .from('columns')
      .select('id, board_id, title, color, position, wip_limit')
      .eq('board_id', id),
    supabase
      .from('cards')
      .select('id, board_id, row_id, column_id, title, position, cover_image_id')
      .eq('board_id', id),
    supabase.from('labels').select('id, board_id, name, color').eq('board_id', id),
    supabase
      .from('card_labels')
      .select('card_id, label_id, cards!inner(board_id)')
      .eq('cards.board_id', id),
    supabase
      .from('images')
      .select('id, board_id, card_id, storage_path, width, height, mime, blurhash')
      .eq('board_id', id),
  ]);

  if (!board) notFound();

  const cardLabelLinks = (cardLabels ?? []).map((link) => ({
    card_id: link.card_id,
    label_id: link.label_id,
  }));

  const isOwner = board.owner_id === user.id;
  let collaborators: Collaborator[] = [];
  if (isOwner) {
    const { data: rawCollabs } = await supabase
      .from('board_collaborators')
      .select('profile_id, role, profiles!inner(display_name)')
      .eq('board_id', id);
    type CollabRow = {
      profile_id: string;
      role: Collaborator['role'];
      profiles: { display_name: string } | { display_name: string }[];
    };
    collaborators = (rawCollabs ?? []).map((c) => {
      const row = c as CollabRow;
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        profile_id: row.profile_id,
        role: row.role,
        display_name: profile?.display_name ?? row.profile_id,
      };
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg-elevated/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/boards"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
            aria-label="Back to boards"
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
          </Link>
          <h1 className="truncate text-sm font-semibold">{board.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <PresenceAvatars
            boardId={board.id}
            me={{
              id: user.id,
              displayName: user.displayName ?? user.email.split('@')[0] ?? 'Anonymous',
              accentColor: user.accentColor ?? 'indigo',
            }}
          />
          <BoardSettings
            boardId={board.id}
            isOwner={isOwner}
            collaborators={collaborators}
            shareToken={board.share_token}
            siteUrl={getSiteUrl()}
            labels={labels ?? []}
          />
          <ThemeToggle />
        </div>
      </header>

      <BoardView
        boardId={board.id}
        initialRows={sortByPosition(rows ?? [])}
        initialColumns={sortByPosition(columns ?? [])}
        initialCards={cards ?? []}
        initialLabels={labels ?? []}
        initialCardLabels={cardLabelLinks}
        initialImages={coverImages ?? []}
      />
    </div>
  );
}
