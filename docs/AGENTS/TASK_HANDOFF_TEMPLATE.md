# Task Handoff — <one-line summary>

> Copy this file, fill in every section, paste **below** the agent primer
> (CODEX_PRIMER.md or GEMINI_PRIMER.md). Delete this blockquote when you fill it in.

## Goal

<One short paragraph. What is the agent producing, and why does it matter?
What does "done" look like?>

## Out of scope

<Things the agent must NOT touch. List concretely. e.g.:
- Do not change anything in `packages/core/ordering.ts`.
- Do not modify the database schema.
- Do not refactor adjacent components.>

## Files in play

- `path/to/primary.tsx` — <role; what the agent will modify>
- `path/to/sibling.ts` — <role; reference only>
- `docs/DESIGN_SYSTEM.md` — <reference for any UI tokens>

## Acceptance criteria

- [ ] <Observable outcome 1 — concrete and testable>
- [ ] <Observable outcome 2>
- [ ] <Observable outcome 3>
- [ ] Passes `pnpm typecheck && pnpm test && pnpm lint`
- [ ] No new dependencies added without prior approval
- [ ] Light and dark modes both rendered (UI tasks only)
- [ ] Touch targets ≥ 44px on smallest viewport (UI tasks only)

## Hints / gotchas

<Links to relevant ADRs, prior PRs, existing patterns. Examples of what good looks like.>

- See `packages/ui/button.tsx` for our shadcn customization pattern.
- ADR: `docs/DECISIONS/0001-stack-choices.md`.
- `prefers-reduced-motion` pattern: `const reduce = useReducedMotion(); ...`

## Deliverable format

- Full file contents for every file you create or modify.
- Each file's first line must be an absolute repo path as a comment:
  ```tsx
  // apps/web/components/board/card.tsx
  ```
- For reviews, return a numbered severity-sorted list (see GEMINI_PRIMER.md).
- If you have questions, list them at the top of your reply and pause.

---

## Example (delete before submitting)

> **Goal**: Implement a `<RowHeader>` component for the board canvas. Shows the
> row title, a color swatch, a collapse chevron, and the card-count for the row.
>
> **Out of scope**: Do not implement the actual collapse animation logic
> (handled by `<BoardGrid>`). Do not add row drag-reorder UI.
>
> **Files in play**:
> - `packages/ui/row-header.tsx` (create)
> - `packages/ui/row-header.test.tsx` (create)
> - `packages/ui/index.ts` (add export)
> - `docs/DESIGN_SYSTEM.md` (reference for tokens)
>
> **Acceptance criteria**:
> - [ ] Renders the row title with `text-xs font-semibold uppercase tracking-wide`
> - [ ] Color swatch is a 12×12 rounded square using the row's color token
> - [ ] Collapse chevron rotates 90° when `collapsed` prop is true (spring animation)
> - [ ] Card count is right-aligned, muted color
> - [ ] Click on the entire header toggles `onToggleCollapsed`
> - [ ] Keyboard: `Enter` and `Space` also toggle
> - [ ] Has Vitest tests covering: render, click toggle, keyboard toggle, collapsed state
> - [ ] Passes `pnpm typecheck && pnpm test && pnpm lint`
>
> **Hints**:
> - See `packages/ui/column-header.tsx` for the analogous pattern (columns).
> - Chevron icon: `<ChevronRight />` from `lucide-react`, stroke 1.5.
> - Animation: Framer Motion `animate={{ rotate: collapsed ? 0 : 90 }}` with the default spring.
