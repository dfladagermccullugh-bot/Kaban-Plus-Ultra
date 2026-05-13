# 0011. Page transitions, mobile bottom-sheet card editor, and the Tiptap dynamic-import

- **Date**: 2026-05-13
- **Status**: accepted

## Context

Phase 6b asked for two motion polish items, on top of Phase 6c/d's a11y +
perf passes:

1. **Subtle page transitions** on the authenticated `(app)` segment.
2. The **card editor modal** at `/b/[id]/(.)c/[cardId]` should be a
   **bottom sheet on `(pointer: coarse)`** (touch) and a centered dialog
   elsewhere.

Both have to honour `prefers-reduced-motion`. The animation primitive is
Framer Motion springs — golden rule #2 in `CLAUDE.md` says
`{ type: 'spring', stiffness: 300, damping: 30 }` (we use the
`stiffness: 220, damping: 28` heavy-surface variant for the modal, per
`docs/DESIGN_SYSTEM.md`).

In parallel, Phase 6d wanted Lighthouse perf ≥ 90 on the web app. The
two biggest pages were:

- `/b/[id]/c/[cardId]` — **263 kB First Load JS** (Tiptap stack)
- `/sign-in` — **153 kB First Load JS** (Supabase browser client)

## Decisions

### Page transitions

Added `apps/web/components/page-transition.tsx`: a client wrapper that
keys an `AnimatePresence` + `motion.div` on `usePathname()` and animates
opacity + a tiny `y` (4 → 0 in, 0 → −2 out) with the default
`{ type: 'spring', stiffness: 300, damping: 30 }`. When
`useReducedMotion()` is true it becomes a `duration: 0` opacity-1 swap
(i.e. no perceptible transition). The wrapper sits in
`apps/web/app/(app)/layout.tsx` so every `(app)` route inherits it.

We deliberately kept the transition tiny:

- Larger slides feel like flicker on RSC pages where the server renders
  HTML for the new route before React mounts.
- 4 px is enough for the eye to register direction without competing
  with the route's own content animations.

### Card editor modal: dialog vs. bottom-sheet

The existing `<CardEditorModal>` was a CSS-only fade-in centered dialog.
We replaced its outer wrapper with:

- `<AnimatePresence onExitComplete={routerPush}>` so the **exit
  animation actually plays** before the parallel route unmounts. Without
  this, clicking the close button instantly unmounted the modal because
  `router.push('/b/[id]')` swaps the `@modal` slot to `default.tsx`.
- An `isSheet` switch driven by `useMediaQuery('(pointer: coarse)')`.
  On coarse pointer we render a bottom-anchored sheet (`fixed inset-x-0
  bottom-0 max-h-[92vh] rounded-t-2xl`) that slides up from `y: 100%`,
  with a sticky drag-handle row that also hosts the close X (so the X
  stays visible when the sheet content scrolls). On fine pointer we
  keep the centered dialog (`rounded-lg max-w-3xl`) and animate
  `{ opacity, y, scale }`.
- Both variants collapse to a zero-duration opacity swap when
  `useReducedMotion()` is true.

### Tiptap dynamic import

`TiptapEditor` (Tiptap core + starter-kit + image + markdown + placeholder)
is the bulk of the modal route. We replaced the static import with
`next/dynamic(() => import('./tiptap-editor'), { ssr: false })` inside
`card-editor-modal.tsx`. Result: `/b/[id]/c/[cardId]` First Load JS
went from **263 kB → 161 kB** (≈ −39 %).

### Sign-in Supabase client deferral

`createClient` from `@supabase/ssr` is only used inside the magic-link
and Google OAuth event handlers, never during initial render. We moved
the import into a `getSupabase()` helper that `await import()`s
`@/lib/supabase/browser` on demand. Result: `/sign-in` First Load JS
went from **153 kB → 116 kB**.

## Alternatives considered

- **CSS-only page transitions** (Tailwind `motion-safe:animate-in`). We
  already had a CSS fade on the modal; the problem with CSS-only is no
  exit-animation hook — the parallel-route swap unmounts immediately
  and the closing fade never plays. AnimatePresence solves that.
- **Drag-to-dismiss sheet** (Framer Motion `drag="y"` + `onDragEnd`).
  Worth doing later; for v1 a tap on the backdrop / drag-handle / close
  X is enough and is keyboard-accessible. Recorded as a follow-up in
  the session log.
- **Replace `next/dynamic` with `React.lazy`** for the Tiptap import.
  Equivalent bundle outcome, but `next/dynamic` lets us declare a
  `loading` placeholder cleanly without a top-level `<Suspense>`.
- **Code-split the magic-link vs. Google handlers separately** on
  `/sign-in`. Diminishing returns — both handlers need the same
  Supabase client; one `await import()` covers both.

## Consequences

What becomes easier:

- Closing the card modal feels like a real dismissal on touch (slide
  out the bottom) and a real dismissal on desktop (centered fade-out).
- The exit animation actually runs because we control `router.push`
  via `onExitComplete`.
- The Tiptap and Supabase chunks are now lazy — the rest of the app
  doesn't pay for them.

What becomes harder:

- Two surface variants in one component. We considered splitting into
  `CardEditorDialog` + `CardEditorSheet` but they share ~95 % of their
  state and effects (title save, body autosave, label CRUD, image
  upload, presence). Splitting would have meant lifting all of that
  into a custom hook — fine to do later but not paying its way today.
- The card modal route renders client-only now (`ssr: false` on
  Tiptap). That's fine because the modal is interactive and never on
  first paint, but means search engines / curl can't see the editor
  body. Card content is private anyway, so no SEO loss.

What we'll watch:

- jsdom doesn't compute real styles, so axe-core's `color-contrast`
  rule is disabled in the Vitest a11y gate. Lighthouse picks that one
  up on the live site. Watch for false-greens.
- `useMediaQuery` returns `false` on first render then flips after
  effect runs. The card modal is always client-only (parallel route
  with `dynamic = 'force-dynamic'`) so we'll see exactly one frame of
  dialog mode before flipping to sheet on touch devices. Acceptable;
  noted here in case anyone sees a flicker.
