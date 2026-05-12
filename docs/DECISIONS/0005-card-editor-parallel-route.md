# 0005. Card editor modal via Next.js parallel + intercepting routes

- **Date**: 2026-05-12
- **Status**: accepted

## Context

Phase 3 needs a card editor that is:

1. Shareable via URL (`/b/[id]/c/[cardId]`)
2. Back-button friendly (closing the modal is `router.back()`)
3. Mounted on top of the board so the grid state isn't lost when opening a card
4. Identical UX whether the user soft-navigates from the board or hits the
   URL cold (the link works either way)

The two realistic options in the App Router:

- **A) Parallel route + intercepting route** — Next's official "modal over
  base page" pattern. A `@modal` slot stays mounted at the layout level. A
  `(.)c/[cardId]/page.tsx` intercepts soft navigation from the board; a
  sibling `c/[cardId]/page.tsx` handles hard navigation.
- **B) Search-param modal** — `router.push('/b/[id]?card=<id>')` plus a
  client-side `useSearchParams()` reader. Single page, no routing magic.

## Decision

Adopt option A — parallel + intercepting routes. The card URL has its own
segment (matches the schema we already use elsewhere: `/b/[id]`), the
board page stays mounted across soft nav (via the parallel `@modal` slot
plus a `default.tsx` fallback for the `children` slot when the URL has
the deeper `/c/[cardId]` segment), and the same `CardModalPage` server
component is reused for both the intercept and the direct route via a
small shared file (`card-modal-page.tsx`).

File layout:

```
app/(app)/b/[id]/
├── layout.tsx                              # renders { children } + { modal }
├── default.tsx                             # re-exports page.tsx so the children slot has
│                                           # a fallback when URL is /c/[cardId]
├── page.tsx                                # the board (unchanged shape)
├── card-modal-page.tsx                     # shared server-component body
└── @modal/
    ├── default.tsx                         # returns null
    ├── (.)c/[cardId]/page.tsx              # intercepting modal (soft nav)
    └── c/[cardId]/page.tsx                 # direct-link modal (hard nav)
```

## Alternatives considered

- **Search-param modal (`?card=<id>`)** — simpler, but feels second-class:
  the URL is uglier, the board page has to know about the param, and the
  modal lifecycle is bolted onto whatever currently owns the board view.
- **Full-page card view** — would lose the "expanded card over a dimmed
  board" affordance Trello users expect.

## Consequences

- The board's `BoardView` now navigates with `router.push('/b/[id]/c/<id>',
  { scroll: false })` to open a card; closing the modal pushes back to
  `/b/[id]`. The grid state is preserved through soft nav.
- `default.tsx` in `b/[id]/` is the *only* reason the `/c/[cardId]` URL
  works on a cold reload — without it Next would 404 the `children` slot.
  Keep it pointing at `page.tsx`.
- The modal's first-load JS is ~120 kB heavier than the board because of
  Tiptap; the upload helper (`upload-card-image.ts`) and the blurhash
  encode are dynamic-imported from inside the modal component to keep
  them off the board's initial bundle.
- If a future iteration wants two cards open at once, or a "next card"
  navigation, it can stack on top of this pattern without re-routing.
