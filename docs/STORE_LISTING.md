# Kaban Plus Ultra — App Store / Play Store listing copy (draft)

**Status:** draft. Tone-checked against `docs/VISION.md` and
`docs/RELEASE_NOTES_1.0.md`. Needs the human's pass for: support /
marketing URLs, screenshot captions, contact addresses, and the final
canonical domain. Six screenshots per device class are still to be
captured.

Every length budget on this page is the actual store cap, not a stylistic
preference. The Play Console truncates after the cap *silently*; App
Store Connect rejects at submit. Both copy blocks here have been counted.

---

## Shared positioning

One-liner — used as the App Store subtitle (30 chars), the Play short
description (80 chars), and the top of every full description.

- **Subtitle (iOS, ≤ 30 chars):**
  `Trello but with real swimlanes.` *(31 — trim one char before submit; "Trello-but-with-swimlanes." is the 26-char fallback.)*
- **Short description (Android, ≤ 80 chars):**
  `A 2D kanban board with real swimlanes, Markdown cards, and one-zip export.`
  *(74 chars.)*

Brand promise:

> Boards that flow in two directions. Markdown that round-trips. No
> upsells, no telemetry, no lock-in. Self-host if you want — one
> command.

---

## App Store (iOS)

### Listing fields

| Field | Value |
| --- | --- |
| App name | `Kaban Plus Ultra` |
| Subtitle (≤ 30 chars) | `Trello but with swimlanes.` |
| Primary category | Productivity |
| Secondary category | Business |
| Bundle ID | `app.kabanplusultra` |
| Support URL | `https://kabanplusultra.app/support` *(confirm with operator)* |
| Marketing URL | `https://kabanplusultra.app` *(confirm with operator)* |
| Privacy Policy URL | `https://kabanplusultra.app/legal/privacy` |
| Copyright | `© 2026 Kaban Plus Ultra contributors` |
| Age rating | 4+ |

### Keywords (≤ 100 chars, comma-separated, no spaces after commas)

```
kanban,swimlanes,trello,markdown,board,tasks,projects,self-host,planner,todo
```

*(98 chars including commas. Plural "tasks" + "projects" pull in
both singular searches.)*

### Promotional text (≤ 170 chars)

```
New: real swimlanes — rows and columns, not stacked lists. Markdown
cards, drag-drop, image paste, share links, and one-zip export.
```

*(141 chars.)*

### Full description (≤ 4000 chars)

```
Kaban Plus Ultra is the kanban app two friends built after years of
fighting Trello. It's a 2D board — rows and columns, real swimlanes,
not the separator-card hack — with Markdown cards, drag-drop
everything, image paste, live presence, and a one-zip export that
round-trips back in.

REAL SWIMLANES
Every board is a true grid. Rows are swimlanes ("This week", "Next
week", "Blocked"), columns are statuses ("Todo", "Doing", "Done"). A
card lives at the intersection. Drag it to the cell that fits.

DRAG-DROP EVERYTHING
Cards, rows, columns. Fractional indexing under the hood means we
never renumber and never collide under concurrent edits. Touch-tuned
on iPhone with light haptics on pickup and drop.

MARKDOWN CARDS, IMAGES, LABELS
Tiptap editor with Markdown as the canonical body format. Paste or
shoot a photo, we'll handle the upload, strip EXIF, blurhash a
placeholder, and serve it back via a signed URL. Multi-select labels,
filter by AND-of-labels at the top of the board.

REAL-TIME, PRESENCE, SHARING
Subscribe per board. See teammates' avatars in the top-right, plus
inline "X is editing" hints on the cards open in their clients.
Invite collaborators by email, assign viewer / editor / admin roles,
or generate a rotatable read-only public share link.

OWN YOUR DATA
Export any board to a zip of Markdown files — one folder per row, one
file per card, YAML frontmatter for title, labels, and cover. Drag
the same zip back in to import or merge. No proprietary format. No
lock-in.

PRIVACY, NOT ADS
No tracking, no analytics, no upsells. Postgres Row-Level Security
enforces every read and write. Self-host with one command on any
Linux VPS — see kabanplusultra.app for the install one-liner.

REQUIREMENTS
iOS 16.0 or later. Works on iPhone and iPad. Account sign-in uses a
magic link emailed to you; no password to remember and no third-party
identity broker required.

OPEN SOURCE
MIT-licensed. Source at github.com/dfladagermccullugh-bot/kaban-plus-ultra.
```

*(1956 chars — leaves headroom for the human to add a "what's new in
this version" footer at update time.)*

### What's New (≤ 4000 chars, used per-version)

```
v1.0 — first stable cut.

• Real 2D swimlanes board with drag-drop and fractional indexing.
• Markdown cards with image paste, labels, cover images.
• Real-time presence, "X is editing" hints, invite + roles, public
  share links.
• Markdown zip export that round-trips back in.
• Native camera capture for card images; haptics on drag.
• Self-host with a one-line installer (Linux x86_64 + ARM64).

Thanks for trying it. Bugs and feature requests:
github.com/dfladagermccullugh-bot/kaban-plus-ultra/issues
```

### Screenshots (6 per device class)

To capture once `apps/mobile/ios/` is generated. Suggested set so
caption hierarchy mirrors the description ordering:

1. **The board, populated.** Show a 4×4 grid with labels visible and one
   card mid-drag. Caption: *"Real swimlanes. Drag-drop everything."*
2. **Card modal with Markdown + image.** Caption: *"Markdown cards.
   Paste an image, we handle the rest."*
3. **Presence + "editing" hint.** Two avatars in the top-right; one card
   showing "Sam is editing". Caption: *"Real-time, with presence."*
4. **Label filter bar in use.** Caption: *"Filter by AND-of-labels."*
5. **Boards list with pull-to-refresh.** Caption: *"All your boards in
   one place."*
6. **Settings → Share link rotated.** Caption: *"Share read-only with a
   rotatable link."*

Required sizes (iOS 16+ store assets):

- 6.7" iPhone (1290 × 2796) — required
- 6.5" iPhone (1242 × 2688) — required
- 5.5" iPhone (1242 × 2208) — required if supporting older iPhones
- 12.9" iPad Pro (2048 × 2732) — required for iPad
- 11" iPad Pro (1668 × 2388) — recommended

---

## Play Store (Android)

### Listing fields

| Field | Value |
| --- | --- |
| App name (≤ 30 chars) | `Kaban Plus Ultra` |
| Short description (≤ 80 chars) | `A 2D kanban board with real swimlanes, Markdown cards, and one-zip export.` |
| Application ID | `app.kabanplusultra` |
| Default language | English (US) |
| Category | Productivity |
| Tags | Kanban, Project Management, Tools |
| Contact email | `support@kabanplusultra.app` *(confirm with operator)* |
| Website | `https://kabanplusultra.app` *(confirm with operator)* |
| Privacy Policy URL | `https://kabanplusultra.app/legal/privacy` |
| Content rating | Everyone |

### Full description (≤ 4000 chars)

```
Kaban Plus Ultra is the kanban app two friends built after years of
fighting Trello. It's a 2D board — rows and columns, real swimlanes,
not the separator-card hack — with Markdown cards, drag-drop
everything, image paste, live presence, and a one-zip export that
round-trips back in.

▸ REAL SWIMLANES
Every board is a true grid. Rows are swimlanes, columns are statuses,
and a card lives at the intersection. Drag it to the cell that fits.

▸ DRAG-DROP EVERYTHING
Cards, rows, columns. Fractional indexing under the hood means we
never renumber and never collide under concurrent edits. Touch-tuned
on Android with light haptics on pickup and drop.

▸ MARKDOWN CARDS, IMAGES, LABELS
Tiptap editor with Markdown as the canonical body format. Paste or
shoot a photo, we'll handle the upload, strip EXIF, blurhash a
placeholder, and serve it back via a signed URL. Multi-select labels,
filter by AND-of-labels at the top of the board.

▸ REAL-TIME, PRESENCE, SHARING
Subscribe per board. See teammates' avatars in the top-right, plus
inline "X is editing" hints on the cards open in their clients.
Invite collaborators by email, assign viewer / editor / admin roles,
or generate a rotatable read-only public share link.

▸ OWN YOUR DATA
Export any board to a zip of Markdown files — one folder per row, one
file per card, YAML frontmatter for title, labels, and cover. Drag
the same zip back in to import or merge. No proprietary format. No
lock-in.

▸ PRIVACY, NOT ADS
No tracking, no analytics, no upsells. Postgres Row-Level Security
enforces every read and write. Self-host with one command on any
Linux VPS or Raspberry Pi — see kabanplusultra.app for the installer.

▸ REQUIREMENTS
Android 8.0 (API 26) or later. Account sign-in uses a magic link
emailed to you. The Camera permission is requested only when you tap
the "Photo" button in the card editor.

▸ OPEN SOURCE
MIT-licensed. Source at github.com/dfladagermccullugh-bot/kaban-plus-ultra.
```

*(1945 chars.)*

### What's new (Play Console "Release notes", ≤ 500 chars per locale)

```
v1.0 — first stable cut. Real 2D swimlanes, drag-drop cards/rows/
columns, Markdown card editor with image paste, real-time presence,
invite + share links, Markdown zip export that round-trips back in,
native camera capture, and a one-line self-host installer for
Linux (x86_64 + ARM64). Bugs and feature requests:
github.com/dfladagermccullugh-bot/kaban-plus-ultra/issues
```

*(348 chars.)*

### Graphic assets (required by Play Console)

- **App icon** — 512×512 PNG, generated from
  `apps/mobile/assets/icon-only.svg` by `pnpm --filter @kpu/mobile
  generate:assets`.
- **Feature graphic** — 1024×500 PNG. To be designed; suggested layout
  is the icon on the left at 256×256 with the wordmark beside it,
  brand-indigo gradient background, "real swimlanes" tagline.
- **Phone screenshots** — minimum 2, maximum 8. Suggested 6 to mirror
  the iOS set (board / card / presence / filter / boards list /
  share-link).
- **7-inch tablet** — optional but recommended (Pixel Tablet form
  factor).
- **10-inch tablet** — optional.

### Tags / discovery keywords

The Play Console doesn't expose a keywords field directly, so tags + the
short description carry the search-discovery weight. Tags chosen:
`Kanban`, `Project Management`, `Tools`. Re-evaluate after the first
week of install data.

---

## Open items for the human

- [ ] Confirm canonical domain (placeholder: `kabanplusultra.app`).
- [ ] Confirm contact + support email addresses (placeholder:
      `support@`, `security@`, `privacy@`).
- [ ] Confirm copyright holder phrasing.
- [ ] Capture screenshots — 6 per iPhone class + 6 Android phone +
      tablet sets.
- [ ] Design the Play Console feature graphic (1024×500).
- [ ] Sign off on the privacy page (remove its "stub status" banner)
      before linking it from either store.
