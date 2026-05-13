# 0009. Camera plugin + board → Markdown ZIP export

- **Date**: 2026-05-13
- **Status**: accepted

## Context

Two remaining Phase 5 items, plus the Phase 6 kickoff item:

1. The card editor only accepted images via paste / drag onto the
   Tiptap surface. On mobile (Capacitor) we needed an explicit way to
   open the OS camera or photo library. The harness spec also asked
   that the existing `<input type="file" accept="image/*">` remain as
   the web fallback — even though no such input existed yet, paste/drag
   is the only path on web today.
2. Phase 6 wants a "own your data" export: a `.zip` of `.md` files,
   one folder per row, one file per card. The format needs to round-
   trip enough metadata to drive an import later in the same phase
   (labels, cover image reference, row/column placement).

## Decisions

### Camera: one helper, platform-detected at call site

`apps/web/lib/camera.ts` exports `pickPhoto(source = 'prompt')` →
`Promise<File | null>`:

- On `Capacitor.isNativePlatform()`: dynamic-imports `@capacitor/camera`,
  calls `Camera.getPhoto({ resultType: DataUrl, source: Prompt, quality:
  85 })`, then converts the data URL to a `Blob` via `fetch`, wraps it
  in a synthetic `File` (`capture-<ms>.<ext>`) so the rest of the
  pipeline keeps treating it like a paste/drop file.
- Otherwise: appends a hidden `<input type="file" accept="image/*"
  capture="environment">` to `document.body`, programmatically clicks
  it, and resolves on `change` (or on the next window focus with no
  file, to detect cancel). Mobile browsers honor `capture` and open the
  OS camera directly; desktop opens the file picker.

The card editor modal mounts a new `AddPhotoButton` next to the
existing Cover button. It calls `pickPhoto`, then forwards the file to
the editor via a new `registerInsertImage` prop on `TiptapEditor` — the
parent stashes the imperative `insert(file)` callback on a ref so the
toolbar button can drive the editor without lifting tiptap state up.
The Tiptap drop/paste path still calls the same `onImageDropped`
handler, so the upload + record-image pipeline is shared.

`@capacitor/camera` is a runtime dep of both `@kpu/web` (because the
plugin's web shim must exist in the bundle that loads in the WebView)
and `@kpu/mobile` (so `cap sync` ships the native plugin bindings).
The dynamic import inside `pickNative` keeps `@kpu/web`'s board-modal
chunk size flat — `/b/[id]/c/[cardId]` stayed at 263 kB.

### iOS Info.plist + Android permissions

Documented in `apps/mobile/README.md`:

- iOS needs `NSCameraUsageDescription`,
  `NSPhotoLibraryUsageDescription`, and (only if we ever enable
  `saveToGallery: true`) `NSPhotoLibraryAddUsageDescription`. Added as
  a checklist for the first dev to run `npx cap add ios`.
- Android: Capacitor injects `CAMERA` + `READ_MEDIA_IMAGES`
  automatically. Documented to verify after `cap sync`.

### Markdown export: route handler, jszip, slug-named folders

`apps/web/app/(app)/b/[id]/export/route.ts` is a `GET` route handler
(not a server action — server actions return JSON, not binary
payloads). It runs as the signed-in user; RLS gates the data fetch, so
viewer+ can export. Service-role is never used here.

Output layout:

```
<board-title>.zip
├── README.md                  # matrix: rows × columns, cell = card titles
└── <row-slug>/                # one folder per row
    └── <card-slug>.md         # one file per card, frontmatter then body
```

Frontmatter (YAML 1.2 always-double-quoted strings so we can skip the
rest of the spec):

```yaml
---
title: "Untitled card"
id: 67890abc-…
row: "In Progress"
column: "Backend"
labels: ["bug", "ui"]
cover: "<board_id>/<card_id>/<file>.jpg"   # or `null`
---
```

Body: the existing `cards.body_md` verbatim — the canonical format
per CLAUDE.md golden rule #5.

Slugging is `toLowerCase + NFKD + strip combining marks (\p{M}) + non-
alphanumeric → '-' + dedupe by `-2`, `-3`, …`. Folder names dedupe per
board, file names dedupe per row, so two rows with the same title still
get distinct folders and two cards with the same title in the same row
still get distinct files.

`jszip@3.10.1` is used in-memory; for v1 boards (<= a few thousand
cards) the buffer is small enough that a streaming zip is not worth
the complexity. Compression is `DEFLATE`. The response sets
`Content-Disposition: attachment; filename="<slug>.zip"`,
`Cache-Control: no-store`.

### Header download button (`<ExportButton>`), available to viewer+

Lives in `apps/web/app/(app)/b/[id]/export-button.tsx`. Renders a
`Download` icon button to the left of the existing settings gear. Uses
`fetch + blob URL + synthetic <a download>` rather than
`window.open(href)` so:

- The user sees a spinner during the (potentially multi-second) zip
  build.
- Server errors (RLS denial, etc.) can be surfaced inline as a small
  popover.
- The current route never unmounts.

Available to viewers / editors / admins / owners — anyone who can read
the board. The settings popover stays owner-only since its other
sections (Share, Collaborators, Labels) still need that gate.

## Alternatives considered

- **Render the Markdown export from the client.** Possible — the board
  state is already in memory after page load — but `body_md` is not
  passed down to the client (the card list only carries `title`,
  `cover_image_id`, position). Re-fetching all card bodies just to
  zip would double the data transfer. Server-side keeps it to one
  round trip.
- **Streaming zip via `archiver` or a `ReadableStream`.** Not worth it
  at our card counts. We can revisit if a self-hosted user with tens
  of thousands of cards starts hitting memory limits.
- **One Markdown file per board (single concatenated doc).** Loses the
  "one file per card" affordance that lets users edit cards in a
  filesystem editor and import them back. Round-trip is the v1 story.
- **Native `Camera` UI before falling back to the OS library prompt.**
  Capacitor's `CameraSource.Prompt` already presents a system sheet
  with both options, which is the platform-native expectation. No
  reason to build our own.
- **Imperative `useImperativeHandle` + `forwardRef` instead of
  `registerInsertImage`.** Same outcome, but the prop-callback shape
  matches how `onImageDropped` already plumbs data out of
  `TiptapEditor` — keeping both interfaces parallel was simpler than
  introducing a ref-forwarding wrapper just for this one method.

## Consequences

- `@kpu/web` now depends on `@capacitor/camera` 6.1.2 and `jszip`
  3.10.1. `@kpu/mobile` also lists `@capacitor/camera` so `cap sync`
  picks up the native plugin pods/gradle entries once the first dev
  runs `npx cap add`.
- `apps/web/app/(app)/b/[id]/export` is a new server-rendered route.
  Build output now shows `/b/[id]/export 135 B / 103 kB` (the route
  handler ships almost nothing — jszip is dynamic-imported).
- `/b/[id]/c/[cardId]` First Load JS unchanged at 263 kB (Capacitor
  camera is dynamic-imported inside `pickPhoto`).
- `/boards` size in the build summary jumped from 3.71 kB → 5.73 kB
  Page JS — that's a Next 15 caching artifact, not a behavior change
  in this branch (no `/boards` files were modified).
- `profiles.email` now documented as PII in `docs/SECURITY.md`. The
  only consumer is the invite server action; no public RLS path
  exposes it.
