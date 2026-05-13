# ADR 0014 — Drag-to-dismiss the mobile bottom sheet

- **Date**: 2026-05-13
- **Status**: Accepted
- **Phase**: 6 (polish — closes a follow-up from ADR 0011)

## Context

ADR 0011 introduced the mobile bottom-sheet variant of the card editor
modal. Tap-to-close works (drag handle + X button + backdrop tap), but
modern iOS / Android conventions expect the sheet to also dismiss when
you drag it down. ADR 0011 listed this as a follow-up.

The naïve `<motion.div drag="y">` on the whole sheet has a bug: every
vertical scroll of the body (where the Tiptap editor and label picker
live) would try to drag the sheet, and the sheet would race with
internal scroll.

## Decision

- Use `useDragControls()` plus `dragListener={false}` on the sheet's
  `<motion.div>`. The drag only starts when we call
  `dragControls.start(e)` from a pointer-down handler on the **sticky
  drag-handle row** at the top of the sheet. Body scroll never triggers
  a drag.
- `dragConstraints={{ top: 0, bottom: 0 }}` snaps the sheet back to
  origin if the gesture is released below threshold.
- `dragElastic={{ top: 0, bottom: 0.4 }}` — pulling up is rigid (no
  rubber band above the resting position); pulling down has a touch of
  elasticity so the gesture feels natural.
- Threshold per the session prompt: close on
  `info.offset.y > 120` **or** `info.velocity.y > 500`. Either gesture
  feels like an intentional dismiss.
- Reuse the existing `close()` callback so `AnimatePresence` still runs
  the exit animation before the parallel-route slot unmounts.
- Reduced-motion users never get drag — `dragEnabled = isSheet && !reduce`.
  They keep tap-to-close on the X / backdrop. Per the golden-rule
  spring rule, motion belongs behind `useReducedMotion()`.
- The close X inside the handle row gets `onPointerDown={(e) =>
  e.stopPropagation()}` so tapping it doesn't start a drag.
- Apply `touch-none` to the handle row so the browser doesn't try to
  treat the gesture as a page scroll while the drag is in flight.

## Alternatives considered

- **Drag the whole sheet, `dragListener` default-on.** Rejected: races
  with body scroll, breaks Tiptap selection drag.
- **A separate "scrim" element above the body that owns the drag.**
  Rejected: extra DOM, accessibility cost (the handle is already the
  visual + semantic affordance).
- **Threshold based purely on offset.** Rejected: a fast flick from
  the top of the sheet wouldn't dismiss without flicking far. Velocity
  catches that case.

## Verified

- `pnpm lint` clean, `pnpm --filter @kpu/web typecheck` clean.
- The existing axe test (`SignInForm` + `ThemeToggle` + button/input)
  doesn't exercise the modal directly, but the modal still renders
  cleanly through the typecheck and the JSX structure is unchanged
  modulo the drag handlers.

## Follow-ups

- A future Playwright pass should script the drag gesture and confirm
  `close()` fires past the threshold and stays open below it.
- Consider a visual peek-through (backdrop opacity tracking
  `motionValue(y)`) so the user gets feedback before reaching the
  dismiss threshold. Polish, not required for v1.
