# Design System

The single source of truth for visual and interaction language.
**Read before any UI change.**

## Philosophy

- **Apple HIG meets Material 3.** Clarity, deference, depth from one side; motion-as-feedback and elevation-as-hierarchy from the other.
- **Restraint over decoration.** If two elements compete for attention, one has to lose.
- **The content is the UI.** Chrome recedes. Cards lead.
- **Motion is communication.** Every animation answers "what just happened?" or "where did it go?". Nothing animates for flair alone.
- **Touch first, mouse second, keyboard always.** Designed for thumbs; rewards a trackpad; perfectly usable from a keyboard.

## Tokens

### Color

We use **OKLCH** color space and CSS variables. The Tailwind v4 preset defines:

```css
@theme {
  --color-bg:           oklch(99% 0 0);          /* light */
  --color-bg-elevated:  oklch(100% 0 0);
  --color-surface:      oklch(97% 0.005 264);
  --color-border:       oklch(92% 0.005 264);
  --color-text:         oklch(20% 0.02 264);
  --color-text-muted:   oklch(55% 0.02 264);
  --color-accent:       oklch(60% 0.18 264);     /* default indigo */
  --color-danger:       oklch(60% 0.22 25);
  --color-success:      oklch(65% 0.16 145);
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-bg:           oklch(15% 0.01 264);
    --color-bg-elevated:  oklch(18% 0.01 264);
    --color-surface:      oklch(22% 0.01 264);
    --color-border:       oklch(28% 0.01 264);
    --color-text:         oklch(96% 0.005 264);
    --color-text-muted:   oklch(70% 0.01 264);
  }
}
```

**Rules:**
- Never use hex literals or `rgb()` in JSX. Always reference Tailwind classes that map to tokens (`bg-surface`, `text-muted-foreground`, etc.).
- Card backgrounds are `bg-elevated`. Board canvas is `bg`. Headers are `bg-surface`.
- The board cover color tints the **header gradient only**. Cards stay neutral.
- User accent is one of 8 presets (indigo, blue, teal, green, lime, amber, rose, violet). Default indigo.

### Spacing (4px grid)

| Token | px | Usage |
|---|---|---|
| `1` | 4 | tight icon padding |
| `2` | 8 | card body inset |
| `3` | 12 | card outer padding |
| `4` | 16 | between cards in a cell |
| `6` | 24 | between columns |
| `8` | 32 | section padding |
| `12` | 48 | hero spacing |

### Radii

Three values only.

| Token | px | Usage |
|---|---|---|
| `radius-sm` | 12 | cards, labels, buttons |
| `radius-md` | 16 | modals, popovers, sheets |
| `radius-lg` | 20 | full-screen surfaces, board cover |

### Shadows

Two tokens only. Heavy elevation is a smell.

| Token | Definition | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px oklch(0% 0 0 / 0.06)` | resting card |
| `shadow-md` | `0 8px 24px oklch(0% 0 0 / 0.12)` | dragging card, open modal |

### Typography

- **UI**: Inter Variable — weights 400, 500, 600, 700
- **Code (markdown blocks)**: JetBrains Mono Variable
- **Line heights**: tight (1.2) for headings, normal (1.5) for body
- **Font sizes** (Tailwind defaults): `xs 12`, `sm 14`, `base 16`, `lg 18`, `xl 20`, `2xl 24`, `3xl 30`

**Rules:**
- Card titles: `text-base font-semibold`
- Card body: `text-sm` rendered markdown
- Column headers: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- Never use more than three distinct sizes on one screen.

### Touch targets

- Minimum 44×44 px for any interactive element on mobile.
- Use `min-h-11 min-w-11` (44px) liberally; never rely on icon size alone.

## Motion

### Default

```ts
const SPRING = { type: 'spring', stiffness: 300, damping: 30 };
```

Use this for: card drag/drop, modal in/out, popover in/out, row collapse, page transitions.

### Variants

| Use case | Tune |
|---|---|
| Default UI | `stiffness: 300, damping: 30` |
| Heavy / large surfaces (modals) | `stiffness: 220, damping: 28` |
| Snappy (toggles, checkboxes) | `stiffness: 500, damping: 30` |
| Drag follow | `stiffness: 600, damping: 40` |

### `prefers-reduced-motion`

- All non-essential motion is disabled.
- State changes (modal open) become instant.
- Layout animations on drag DO remain (they communicate where the card went) but are <80ms cross-fades instead of springs.

Implementation pattern:

```tsx
const reduce = useReducedMotion();
<motion.div
  layout
  transition={reduce ? { duration: 0.08 } : SPRING}
/>
```

### Layout animations

- Every reorderable list uses Framer Motion `layout` + stable `layoutId`.
- Cards animate to their new (row, column) cell on every drop.
- Row collapse: height + opacity spring; not a `display: none` snap.

### Page transitions (mobile)

- Shared-element transitions via `motion.div layoutId` for board-cover → board-canvas.
- Backwards navigation reverses the same `layoutId`.

## Components

Use **shadcn/ui** as the base. When customizing:

- Buttons: `default`, `secondary`, `ghost`, `destructive` only. No `outline` variant — too quiet for our hierarchy.
- Modals (`Dialog`): max-width `lg` on desktop, full-sheet on mobile (<640px).
- Popovers: `radius-md`, `shadow-md`, 8px arrow.
- Inputs: 1px border, focus ring uses `--color-accent` at 30% opacity.
- Avatars: circle; initials fallback on `--color-surface`; 24/32/40px sizes only.

## Iconography

- **Lucide** icons exclusively (`lucide-react`).
- Stroke width **1.5** everywhere. Never mix strokes.
- Size: 16 (inline), 20 (button), 24 (header).

## Imagery

- Card covers: 16:9 aspect, `object-cover`, `radius-sm` top corners only.
- Inline images in markdown: `radius-sm`, max-width 100%, lazy-loaded.
- Always render a **blurhash** placeholder while loading (stored on the `images` row).

## Accessibility

- All interactive elements keyboard reachable; visible focus ring (no `outline: none` without a replacement).
- Color contrast WCAG AA minimum; AAA for body text.
- All icons used alone have an `aria-label`.
- Drag-and-drop has a keyboard equivalent (arrow keys + space to "pick up" / "drop"; dnd-kit provides this).
- Live regions announce drag pickup, drop, and undo opportunities.

## Don't

- ❌ Inline `style={{ color: '#5566ff' }}`. Use a token.
- ❌ More than two shadow values in one screen.
- ❌ Gradients on cards. (Headers only, and only board cover.)
- ❌ Animations longer than 400ms.
- ❌ Eased tweens for interactive motion. Springs only.
- ❌ Icons with mismatched stroke widths.
- ❌ More than three font sizes on one screen.
- ❌ Dark-mode-only or light-mode-only screens. Both, always.

## Do

- ✅ Reach for restraint first. Decoration last.
- ✅ Animate layout, not just opacity.
- ✅ Make every motion answer "what just happened?".
- ✅ Test with `prefers-reduced-motion: reduce` enabled.
- ✅ Test on a real iPhone SE-sized viewport (375px wide).
