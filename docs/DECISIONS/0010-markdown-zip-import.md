# 0010. Markdown ZIP import (round-trip with the export)

- **Date**: 2026-05-13
- **Status**: accepted

## Context

ADR 0009 shipped board → `.zip` of `.md` files. Phase 6's next step is
the round trip: take a `.zip` (either one produced by `/b/[id]/export`
or any archive with the same layout) and recreate / merge it into a
board. Two distinct UX surfaces:

1. Drop a `.zip` on `/boards` → create a brand-new board owned by the
   signed-in user.
2. Drop a `.zip` on `/b/[id]` → merge the archive into the current
   board (only available if the signed-in user has editor+ access; RLS
   enforces this).

The format is fully under our control, so the parser only needs to
handle the exact shape the exporter emits — not arbitrary
hand-written Markdown.

## Decisions

### Parser lives in `@kpu/core`, framework-free

`packages/core/src/markdown-import.ts` is pure TS — no Supabase, no
React, no Node-specific APIs. Inputs are `ImportEntry[]` (path +
UTF-8 content); output is an `ImportedBoard` model (title, rows[],
columns[], labels[], cards[]) the server action turns into Supabase
inserts. This keeps the parser unit-testable (`13` tests in
`markdown-import.test.ts`) and reusable from a future client-side
preview if we ever want one.

### Frontmatter parser: handle exactly what we emit, no more

YAML in full is a notorious foot-gun. The exporter only emits:

- Always-double-quoted strings with `\\` / `\"` escapes
  (`title: "foo"`)
- An inline array of double-quoted strings (`labels: ["a", "b"]`)
- A bare `null` literal (`cover: null`)
- A bare UUID for `id` (no quotes needed)

The parser whitelists exactly those shapes and throws a clear error
on anything else (e.g. `\n` escapes, block scalars, flow mappings).
Better to fail loudly than to silently mis-parse.

CRLF line endings are normalized up front so the `---` delimiters
match cleanly even if a file passed through a Windows editor.

### Zip extraction at the server-action boundary

`jszip` is imported dynamically inside the server actions (same
pattern as the exporter's `/export` route). The parser sees only the
list of decoded entries — it never touches `jszip` itself. This keeps
the `@kpu/core` package free of runtime deps and makes the parser
trivially fuzzable.

### Two server actions, not one

- `apps/web/app/(app)/boards/import-actions.ts` →
  `importBoardFromZip(formData)` creates a brand-new board.
- `apps/web/app/(app)/b/[id]/import-actions.ts` →
  `mergeBoardFromZip(boardId, formData)` merges into an existing one.

Both run as the signed-in user (RLS enforces ownership / editor
role). Service-role is never used.

The create path uses sequential integer positions per (row, column)
cell — fractional indexing isn't needed because every position is
fresh. The merge path queries the existing max position per cell and
appends after it, so existing cards keep their order and the
imported cards land on the end.

Row / column / label matching in merge is **case-insensitive title
matching** (`String.toLowerCase().trim()`). The alternative — match
by `id` from the frontmatter — would let exported-and-reimported
boards stay in sync, but cross-board imports would never match
anything. Title matching is the right default for "I exported this
board, edited some cards in my filesystem, drop it back in"; the
`id` field is preserved in the export as informational metadata for
future tooling.

We never **overwrite** an existing card on merge — the safe default
is to always append. Idempotent re-imports therefore duplicate
cards; that's a known trade-off documented in the dropzone hint
("Rows / columns / labels are matched by title; new ones are
appended.").

### `<ZipDropzone>` is a shared overlay component

`apps/web/components/zip-dropzone.tsx` exposes a window-level
drag-drop listener and a fixed-position overlay that only renders
while a file is being dragged or a result is pending. It's
framework-agnostic about the action — callers pass an
`onFile(file) => Promise<{ok, message}|{ok:false, error}>` callback.

Two thin wrappers — `apps/web/app/(app)/boards/import-dropzone.tsx`
and `apps/web/app/(app)/b/[id]/import-dropzone.tsx` — wire it to the
two server actions and handle the navigation / `router.refresh()`
side effects.

**Guard for editor drops.** The Tiptap card editor at
`/b/[id]/(.)c/[cardId]` accepts image drops via its own ProseMirror
handler. A naive window-level listener would intercept those. The
guard checks `e.target.closest('[contenteditable="true"],
.ProseMirror')` and bails out so editor drops fall through to the
existing `onImageDropped` pipeline untouched.

### File size cap

20 MB per upload, enforced inside the server action before the zip
is parsed. A v1 KPU board's `.zip` of `.md` files (no embedded
images) is well under that — even a board with thousands of cards
serializes to a few MB. The cap is a defensive measure against
"upload a `.zip` of arbitrary big files" abuse.

## Alternatives considered

- **A single dropzone on `/boards` that also handles merge via a
  modal.** Worse UX: the user has to pick a destination after the
  drop. The "drop on the page that represents the destination" model
  is the obvious mental shortcut.
- **Match rows / columns by `id` from the frontmatter.** Better for
  exact round-trips of the same board, worse for everything else (a
  re-imported export onto a different board would create everything
  from scratch). Title matching is the default; we can add an
  `--by-id` mode later if anyone asks.
- **Overwrite existing cards on merge.** Considered and rejected. We
  don't know whether the imported card or the live one is newer.
  Idempotent re-imports producing duplicates is the safer failure
  mode than silently destroying edits.
- **Use a hand-rolled YAML parser library (`yaml`, `js-yaml`).**
  Heavy (`yaml` is ~80 kB minified). The exporter emits a strict
  subset, so a hand-written 60-line parser is enough and ships
  zero kB to the client.
- **Folder import (browser File System Access API + a button).**
  Possible but harder: requires user-gesture-initiated picker, no
  Safari support, and the round-trip already works via the zip.
  Out of scope for v1.

## Consequences

- `/boards` First Load JS grew from 5.73 kB to 7.08 kB Page JS
  (`<ImportDropzone>` is a client component; the dropzone overlay
  ships in the same chunk).
- `/b/[id]` Page JS unchanged at 138 B (the import dropzone is
  loaded from the layout boundary just like the export button).
- `@kpu/core` now ships a `markdown-import` entry point alongside
  `ordering`. The parser is the only new export; no new runtime
  deps.
- A re-import duplicates cards. Users wanting a true "sync" need
  to clear the destination board first. We can revisit by adding
  an `id`-based de-dup pass if it becomes a common request.
- Cover images (`cover: "..."` storage paths) are parsed but **not**
  re-attached on import. The export `.zip` doesn't include the
  binary image content; recreating cover links would require either
  shipping the binaries inside the archive or assuming the
  destination shares the same storage bucket as the source. Both
  are out of scope for the v1 round trip.
