# Mobile launch assets

Source artwork for the iOS / Android launch icon + splash screen. Generated
into per-platform `AppIcon.appiconset` / mipmap directories by
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets).

## Files

| File | Role | Size |
|---|---|---|
| `icon-only.svg` | iOS app icon (and Android legacy launcher fallback) | 1024×1024 |
| `icon-foreground.svg` | Android adaptive-icon foreground layer | 1024×1024 (66% safe zone) |
| `icon-background.svg` | Android adaptive-icon background layer | 1024×1024 (solid gradient) |
| `splash.svg` | Light-mode splash | 2732×2732 |
| `splash-dark.svg` | Dark-mode splash | 2732×2732 |

The 2×2 card grid motif comes from the headline "real swimlanes" feature. The
bottom-right card is offset upward to suggest a card mid-drag across rows.
Indigo background tracks the design-system `--color-accent` token
(`oklch(60% 0.18 264)` ≈ `#5B6CE8`).

## Regenerating per-platform assets

Once `npx cap add ios` and `npx cap add android` have been run on a dev
machine with Xcode + Android Studio, run from `apps/mobile/`:

```bash
pnpm generate:assets
```

That wraps `npx --yes @capacitor/assets@3 generate --iconBackgroundColor
'#5B6CE8' --iconBackgroundColorDark '#1B1D27' --splashBackgroundColor
'#FCFCFD' --splashBackgroundColorDark '#1B1D27'`, which scans this folder for
the files above and writes the per-platform asset bundles into
`apps/mobile/ios/App/App/Assets.xcassets/` and
`apps/mobile/android/app/src/main/res/`.

`@capacitor/assets` is fetched on demand via `npx --yes` so the workspace
`pnpm install` stays lean; the package only matters when there are real
native projects to write into.

## Edits

- Edit only the `.svg` sources here. Never hand-edit the generated PNG
  bundles &mdash; they will be overwritten next time `generate:assets`
  runs.
- If you change the brand colors, also update
  `docs/DESIGN_SYSTEM.md` (Tokens / Color) so the web and mobile stay
  pinned to the same accent.
