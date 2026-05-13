import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
/**
 * Board → Markdown ZIP export.
 *
 * Layout:
 *   <board-title>.zip
 *   ├─ README.md                # board overview (rows × columns table)
 *   └─ <row-title>/             # one folder per row
 *       └─ <card-title>.md      # one file per card; YAML frontmatter on top
 *
 * Frontmatter (per card):
 *   ---
 *   title: "<card title>"
 *   id: <uuid>
 *   row: "<row title>"
 *   column: "<column title>"
 *   labels: ["bug", "ui"]
 *   cover: "<storage-path>"     # nullable
 *   ---
 *
 * Auth: same RLS as the board page. Anyone with viewer+ access can pull
 * their own export. Service-role is never used here.
 */
import { sortByPosition } from '@kpu/core';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CardRow = {
  id: string;
  row_id: string;
  column_id: string;
  title: string;
  body_md: string;
  position: number;
  cover_image_id: string | null;
};

type LabelRow = { id: string; name: string; color: string };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: boardId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const supabase = await createClient();

  const [
    { data: board, error: boardErr },
    { data: rows },
    { data: columns },
    { data: cards },
    { data: labels },
    { data: cardLabels },
    { data: images },
  ] = await Promise.all([
    supabase.from('boards').select('id, title').eq('id', boardId).maybeSingle(),
    supabase.from('rows').select('id, title, position').eq('board_id', boardId),
    supabase.from('columns').select('id, title, position').eq('board_id', boardId),
    supabase
      .from('cards')
      .select('id, row_id, column_id, title, body_md, position, cover_image_id')
      .eq('board_id', boardId),
    supabase.from('labels').select('id, name, color').eq('board_id', boardId),
    supabase
      .from('card_labels')
      .select('card_id, label_id, cards!inner(board_id)')
      .eq('cards.board_id', boardId),
    supabase.from('images').select('id, storage_path').eq('board_id', boardId),
  ]);

  if (boardErr || !board) {
    return NextResponse.json({ error: 'Board not found or no access.' }, { status: 404 });
  }

  const orderedRows = sortByPosition(rows ?? []);
  const orderedColumns = sortByPosition(columns ?? []);
  const labelById = new Map<string, LabelRow>((labels ?? []).map((l) => [l.id, l]));
  const imageById = new Map<string, string>((images ?? []).map((i) => [i.id, i.storage_path]));
  const labelsByCard = new Map<string, string[]>();
  for (const link of cardLabels ?? []) {
    const list = labelsByCard.get(link.card_id) ?? [];
    list.push(link.label_id);
    labelsByCard.set(link.card_id, list);
  }

  const cardsByRow = new Map<string, CardRow[]>();
  for (const card of (cards ?? []) as CardRow[]) {
    const list = cardsByRow.get(card.row_id) ?? [];
    list.push(card);
    cardsByRow.set(card.row_id, list);
  }
  for (const [k, v] of cardsByRow) cardsByRow.set(k, sortByPosition(v));

  // Lazy-import jszip so the route's cold-start cost only fires when used.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  // README.md — board overview matrix.
  zip.file('README.md', renderReadme(board.title, orderedRows, orderedColumns, cardsByRow));

  // Per-row folders + per-card files.
  const usedFolderNames = new Set<string>();
  const columnTitleById = new Map<string, string>(orderedColumns.map((c) => [c.id, c.title]));
  for (const row of orderedRows) {
    const folder = uniqueSlug(row.title || 'untitled-row', usedFolderNames);
    const usedFileNames = new Set<string>();
    const rowCards = cardsByRow.get(row.id) ?? [];
    for (const card of rowCards) {
      const file = `${uniqueSlug(card.title || 'untitled-card', usedFileNames)}.md`;
      const labelNames = (labelsByCard.get(card.id) ?? [])
        .map((id) => labelById.get(id)?.name)
        .filter((s): s is string => Boolean(s));
      const coverPath = card.cover_image_id ? (imageById.get(card.cover_image_id) ?? null) : null;
      const md = renderCard({
        title: card.title,
        id: card.id,
        rowTitle: row.title,
        columnTitle: columnTitleById.get(card.column_id) ?? '',
        labels: labelNames,
        cover: coverPath,
        body: card.body_md ?? '',
      });
      zip.file(`${folder}/${file}`, md);
    }
    // Make sure empty rows still appear in the archive.
    if (rowCards.length === 0) {
      zip.file(`${folder}/.gitkeep`, '');
    }
  }

  const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const filename = `${uniqueSlug(board.title || 'board', new Set())}.zip`;

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ─── Rendering helpers ──────────────────────────────────────────────────────

function renderReadme(
  boardTitle: string,
  rows: { id: string; title: string }[],
  columns: { id: string; title: string }[],
  cardsByRow: Map<string, { column_id: string; title: string }[]>,
): string {
  const lines: string[] = [];
  lines.push(`# ${boardTitle}`);
  lines.push('');
  lines.push(`Exported from Kaban Plus Ultra on ${new Date().toISOString().slice(0, 10)}.`);
  lines.push('');
  if (rows.length === 0 || columns.length === 0) {
    lines.push('_This board is empty._');
    return `${lines.join('\n')}\n`;
  }
  const header = ['', ...columns.map((c) => c.title || '—')];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    const cells: string[] = [row.title || '—'];
    const list = cardsByRow.get(row.id) ?? [];
    for (const col of columns) {
      const inCell = list.filter((c) => c.column_id === col.id).map((c) => c.title || '—');
      cells.push(inCell.length ? inCell.join('<br>') : '');
    }
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

function renderCard(input: {
  title: string;
  id: string;
  rowTitle: string;
  columnTitle: string;
  labels: string[];
  cover: string | null;
  body: string;
}): string {
  const fm: string[] = ['---'];
  fm.push(`title: ${yamlString(input.title)}`);
  fm.push(`id: ${input.id}`);
  fm.push(`row: ${yamlString(input.rowTitle)}`);
  fm.push(`column: ${yamlString(input.columnTitle)}`);
  fm.push(`labels: [${input.labels.map(yamlString).join(', ')}]`);
  fm.push(`cover: ${input.cover ? yamlString(input.cover) : 'null'}`);
  fm.push('---');
  fm.push('');
  fm.push(`# ${input.title || 'Untitled'}`);
  fm.push('');
  fm.push(input.body.trim());
  // Trailing newline keeps POSIX text editors happy.
  return `${fm.join('\n')}\n`;
}

function yamlString(value: string): string {
  // Always-quote, escape backslashes and double quotes. YAML 1.2 allows this
  // shape unconditionally, which lets us skip the rest of the spec.
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function uniqueSlug(input: string, used: Set<string>): string {
  const base = slug(input);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  let candidate = `${base}-${i}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  used.add(candidate);
  return candidate;
}

function slug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    // Drop diacritics / combining marks left behind by NFKD.
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'untitled';
}
