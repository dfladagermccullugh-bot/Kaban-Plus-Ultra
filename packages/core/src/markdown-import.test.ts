import { describe, expect, it } from 'vitest';
import { type ImportEntry, parseCardFile, parseImportedBoard } from './markdown-import';

function cardFile(
  overrides: {
    title?: string;
    id?: string;
    row?: string;
    column?: string;
    labels?: string[];
    cover?: string | null;
    body?: string;
  } = {},
): string {
  const title = overrides.title ?? 'Card title';
  const id = overrides.id ?? '67890abc';
  const row = overrides.row ?? 'In Progress';
  const column = overrides.column ?? 'Backend';
  const labels = overrides.labels ?? [];
  const cover = overrides.cover === undefined ? null : overrides.cover;
  const body = overrides.body ?? '';
  const yaml = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const fm = [
    '---',
    `title: ${yaml(title)}`,
    `id: ${id}`,
    `row: ${yaml(row)}`,
    `column: ${yaml(column)}`,
    `labels: [${labels.map(yaml).join(', ')}]`,
    `cover: ${cover === null ? 'null' : yaml(cover)}`,
    '---',
    '',
    `# ${title}`,
    '',
    body,
  ].join('\n');
  return `${fm}\n`;
}

describe('parseCardFile', () => {
  it('extracts the standard frontmatter fields', () => {
    const parsed = parseCardFile(
      cardFile({
        title: 'Finish feature',
        row: 'In Progress',
        column: 'Backend',
        labels: ['bug', 'ui'],
        cover: 'boards/abc/cards/def/cover.jpg',
        body: 'Some body.',
      }),
    );
    expect(parsed.title).toBe('Finish feature');
    expect(parsed.rowTitle).toBe('In Progress');
    expect(parsed.columnTitle).toBe('Backend');
    expect(parsed.labels).toEqual(['bug', 'ui']);
    expect(parsed.cover).toBe('boards/abc/cards/def/cover.jpg');
    expect(parsed.bodyMd).toBe('Some body.');
  });

  it('returns an empty body when only the title heading is present', () => {
    expect(parseCardFile(cardFile({ title: 'Empty', body: '' })).bodyMd).toBe('');
  });

  it('keeps the body when no leading "# Title" heading is present', () => {
    const md = [
      '---',
      'title: "Plain"',
      'id: aaa',
      'row: "R"',
      'column: "C"',
      'labels: []',
      'cover: null',
      '---',
      '',
      'Just a paragraph.',
    ].join('\n');
    expect(parseCardFile(md).bodyMd).toBe('Just a paragraph.');
  });

  it('handles cover: null', () => {
    expect(parseCardFile(cardFile({ cover: null })).cover).toBeNull();
  });

  it('unescapes \\\\ and \\" inside quoted strings', () => {
    const parsed = parseCardFile(cardFile({ title: 'a "b" \\c' }));
    expect(parsed.title).toBe('a "b" \\c');
  });

  it('rejects unknown backslash escapes', () => {
    const md = [
      '---',
      'title: "bad\\nescape"',
      'id: a',
      'row: "r"',
      'column: "c"',
      'labels: []',
      'cover: null',
      '---',
      '',
    ].join('\n');
    expect(() => parseCardFile(md)).toThrow(/Unsupported escape/);
  });

  it('throws when frontmatter is missing', () => {
    expect(() => parseCardFile('no frontmatter here')).toThrow(/frontmatter/);
  });

  it('throws when a required field is absent', () => {
    const md = ['---', 'title: "ok"', 'id: a', '---', '', 'body'].join('\n');
    expect(() => parseCardFile(md)).toThrow(/row/);
  });

  it('tolerates CRLF line endings', () => {
    const lf = cardFile({ title: 'CRLF', body: 'Body' });
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(parseCardFile(crlf).title).toBe('CRLF');
  });
});

describe('parseImportedBoard', () => {
  it('round-trips a small board', () => {
    const entries: ImportEntry[] = [
      {
        path: 'README.md',
        content: '# My board\n\nExported from KPU.\n',
      },
      {
        path: 'to-do/first.md',
        content: cardFile({
          title: 'First',
          row: 'To do',
          column: 'Now',
          labels: ['bug'],
          body: 'Body 1',
        }),
      },
      {
        path: 'to-do/second.md',
        content: cardFile({
          title: 'Second',
          row: 'To do',
          column: 'Later',
          labels: ['ui'],
        }),
      },
      {
        path: 'doing/third.md',
        content: cardFile({
          title: 'Third',
          row: 'Doing',
          column: 'Now',
          labels: ['bug', 'ui'],
        }),
      },
    ];
    const board = parseImportedBoard(entries);
    expect(board.title).toBe('My board');
    expect(board.rows).toEqual(['To do', 'Doing']);
    expect(board.columns).toEqual(['Now', 'Later']);
    expect(board.labels).toEqual(['bug', 'ui']);
    expect(board.cards.map((c) => c.title)).toEqual(['First', 'Second', 'Third']);
  });

  it('preserves empty rows via .gitkeep', () => {
    const entries: ImportEntry[] = [
      { path: 'README.md', content: '# Board\n' },
      {
        path: 'to-do/only.md',
        content: cardFile({ title: 'Only', row: 'To do', column: 'Now' }),
      },
      { path: 'archive/.gitkeep', content: '' },
    ];
    const board = parseImportedBoard(entries);
    expect(board.rows).toEqual(['To do', 'Archive']);
  });

  it('falls back to default title when README is missing', () => {
    const entries: ImportEntry[] = [
      {
        path: 'r/c.md',
        content: cardFile({ title: 'X', row: 'R', column: 'C' }),
      },
    ];
    expect(parseImportedBoard(entries).title).toBe('Imported board');
  });

  it('ignores leading ./ and nested non-card files', () => {
    const entries: ImportEntry[] = [
      { path: './README.md', content: '# B\n' },
      { path: './to-do/one.md', content: cardFile({ row: 'To do', column: 'C' }) },
      { path: 'to-do/.DS_Store', content: 'junk' },
      { path: 'deep/nested/thing.md', content: cardFile({ row: 'X', column: 'Y' }) },
    ];
    const board = parseImportedBoard(entries);
    expect(board.cards).toHaveLength(1);
  });
});
