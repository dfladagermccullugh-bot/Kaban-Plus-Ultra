/**
 * Markdown ZIP import — the round-trip counterpart to the export
 * route at `apps/web/app/(app)/b/[id]/export/route.ts`.
 *
 * Inputs are file entries already extracted from the `.zip` by the
 * caller (server action). Output is a normalized board model the
 * caller turns into Supabase inserts.
 *
 * The export's emitted frontmatter is a strict subset of YAML 1.2 —
 * always-double-quoted strings (with `\\` and `\"` escapes) plus a
 * one-line array of strings — so the parser only needs to handle
 * that exact shape. Anything else throws a clear error.
 */
export type ImportEntry = {
  /** POSIX path inside the archive, e.g. `to-do/finish-feature.md`. */
  path: string;
  /** UTF-8 file contents. */
  content: string;
};

export type ImportedCard = {
  title: string;
  /** Original card id from the export, if the exporter included it. */
  sourceId?: string;
  rowTitle: string;
  columnTitle: string;
  labels: string[];
  /** Storage path of the cover image at export time (informational only). */
  cover: string | null;
  bodyMd: string;
};

export type ImportedBoard = {
  /** Title parsed from the README `# heading`, or `'Imported board'`. */
  title: string;
  /** Rows in first-appearance order. */
  rows: string[];
  /** Columns in first-appearance order. */
  columns: string[];
  /** Distinct label names referenced by any card. */
  labels: string[];
  cards: ImportedCard[];
};

export type ParsedCardFile = {
  title: string;
  sourceId?: string;
  rowTitle: string;
  columnTitle: string;
  labels: string[];
  cover: string | null;
  bodyMd: string;
};

/** Parse a single `<row>/<card>.md` file's frontmatter + body. */
export function parseCardFile(content: string): ParsedCardFile {
  const fm = extractFrontmatter(content);
  if (!fm) throw new Error('Card file is missing a YAML frontmatter block.');

  const title = requireString(fm.fields, 'title');
  const rowTitle = requireString(fm.fields, 'row');
  const columnTitle = requireString(fm.fields, 'column');
  const labels = parseStringArray(fm.fields.labels ?? '[]', 'labels');
  const coverRaw = fm.fields.cover;
  const cover =
    coverRaw === undefined || coverRaw === 'null' || coverRaw === '~'
      ? null
      : parseYamlString(coverRaw, 'cover');

  const sourceIdRaw = fm.fields.id;
  const sourceId = sourceIdRaw ? stripQuotes(sourceIdRaw) : undefined;

  // Strip the optional `# Title` line the exporter writes right after
  // the frontmatter block — we already have the canonical title from
  // the frontmatter, so duplicating it as a heading would round-trip
  // poorly.
  let body = fm.body.replace(/^\s*\n+/, '');
  const titleHeading = `# ${title}`;
  if (body.startsWith(`${titleHeading}\n`)) {
    body = body.slice(titleHeading.length + 1).replace(/^\n+/, '');
  } else if (body.trim() === titleHeading) {
    body = '';
  }

  return {
    title,
    sourceId,
    rowTitle,
    columnTitle,
    labels,
    cover,
    bodyMd: body.replace(/\s+$/, ''),
  };
}

/**
 * Parse an array of zip entries into a normalized board model.
 *
 * - Card files at `<row-slug>/<card-slug>.md` drive everything; row
 *   order is the order of first appearance.
 * - The README's `# heading` is the board title; if absent, the
 *   caller's fallback wins.
 * - `.gitkeep` files are tolerated (they preserve empty rows in the
 *   export) and contribute the row even without any cards.
 * - Anything else (images, hidden files) is silently skipped.
 */
export function parseImportedBoard(entries: ImportEntry[]): ImportedBoard {
  let title = 'Imported board';
  const rows: string[] = [];
  const rowSeen = new Set<string>();
  const columns: string[] = [];
  const columnSeen = new Set<string>();
  const labels: string[] = [];
  const labelSeen = new Set<string>();
  const cards: ImportedCard[] = [];

  // Track empty-row folders by slug (no cards but a `.gitkeep`) so we
  // can synthesize the row title from the slug if the README is
  // missing.
  const emptyRowSlugs = new Set<string>();

  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path || path.endsWith('/')) continue;

    // Top-level README.md → extract board title.
    if (path.toLowerCase() === 'readme.md') {
      const match = entry.content.match(/^\s*#\s+(.+?)\s*$/m);
      if (match?.[1]) title = match[1].trim();
      continue;
    }

    const segments = path.split('/');
    if (segments.length !== 2) continue;
    const [folder, file] = segments as [string, string];
    if (file === '.gitkeep') {
      emptyRowSlugs.add(folder);
      continue;
    }
    if (!file.toLowerCase().endsWith('.md')) continue;

    let parsed: ParsedCardFile;
    try {
      parsed = parseCardFile(entry.content);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'parse error';
      throw new Error(`Failed to parse ${path}: ${reason}`);
    }

    if (!rowSeen.has(parsed.rowTitle)) {
      rowSeen.add(parsed.rowTitle);
      rows.push(parsed.rowTitle);
    }
    if (!columnSeen.has(parsed.columnTitle)) {
      columnSeen.add(parsed.columnTitle);
      columns.push(parsed.columnTitle);
    }
    for (const label of parsed.labels) {
      if (!labelSeen.has(label)) {
        labelSeen.add(label);
        labels.push(label);
      }
    }
    cards.push(parsed);
  }

  // Promote any empty-row folder we haven't already seen via a card.
  // We don't have the original row title, so unslug it as best we can.
  for (const slug of emptyRowSlugs) {
    const guessed = unslug(slug);
    if (!rowSeen.has(guessed)) {
      rowSeen.add(guessed);
      rows.push(guessed);
    }
  }

  return { title, rows, columns, labels, cards };
}

// ─── Frontmatter primitives ──────────────────────────────────────

type Frontmatter = { fields: Record<string, string>; body: string };

function extractFrontmatter(content: string): Frontmatter | null {
  // Normalize CRLF so the `---` delimiters match cleanly.
  const text = content.replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const after = text.slice(end + 4);
  const body = after.startsWith('\n') ? after.slice(1) : after;

  const fields: Record<string, string> = {};
  for (const rawLine of block.split('\n')) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const colon = rawLine.indexOf(':');
    if (colon === -1) continue;
    const key = rawLine.slice(0, colon).trim();
    const value = rawLine.slice(colon + 1).trim();
    fields[key] = value;
  }
  return { fields, body };
}

function requireString(fields: Record<string, string>, key: string): string {
  const raw = fields[key];
  if (raw === undefined) throw new Error(`Missing required field "${key}".`);
  return parseYamlString(raw, key);
}

function parseYamlString(raw: string, key: string): string {
  if (raw.length === 0) return '';
  if (raw[0] === '"' && raw[raw.length - 1] === '"' && raw.length >= 2) {
    // Unescape `\\` and `\"`; reject any other backslash escapes so
    // we never silently lose data.
    return raw.slice(1, -1).replace(/\\(.)/g, (_match, char) => {
      if (char === '\\' || char === '"') return char;
      throw new Error(`Unsupported escape \\${char} in field "${key}".`);
    });
  }
  // Plain scalar (no quotes). The exporter never emits this, but
  // tolerate it for hand-edited files.
  return raw;
}

function parseStringArray(raw: string, key: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '[]') return [];
  if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    throw new Error(`Field "${key}" must be an inline array.`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];

  const out: string[] = [];
  let i = 0;
  while (i < inner.length) {
    // Skip whitespace + leading comma.
    while (i < inner.length && (inner[i] === ',' || /\s/.test(inner[i] as string))) i += 1;
    if (i >= inner.length) break;
    if (inner[i] !== '"') {
      throw new Error(`Field "${key}" expects double-quoted strings.`);
    }
    // Consume one double-quoted string with `\\` / `\"` escapes.
    i += 1;
    let value = '';
    while (i < inner.length) {
      const ch = inner[i];
      if (ch === '\\') {
        const next = inner[i + 1];
        if (next === '"' || next === '\\') {
          value += next;
          i += 2;
          continue;
        }
        throw new Error(`Unsupported escape \\${next} in field "${key}".`);
      }
      if (ch === '"') {
        i += 1;
        out.push(value);
        break;
      }
      value += ch;
      i += 1;
    }
  }
  return out;
}

function stripQuotes(raw: string): string {
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
    return raw.slice(1, -1);
  }
  return raw;
}

function normalizePath(path: string): string {
  // Drop a leading `./` and any leading slashes so callers can be
  // sloppy about where the entries originated.
  let p = path;
  while (p.startsWith('./')) p = p.slice(2);
  while (p.startsWith('/')) p = p.slice(1);
  return p;
}

function unslug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
