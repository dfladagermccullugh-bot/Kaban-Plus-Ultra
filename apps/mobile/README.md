# @kpu/mobile

Capacitor shell that wraps `@kpu/web` for iOS and Android. One TypeScript
codebase, three platforms.

## ⚠️ Native projects checklist (read this first)

The `ios/` and `android/` project folders are **not** in the repo yet —
they have to be generated on a developer machine that has Xcode and
Android Studio installed. The CI harness that ran the previous sessions
has neither, so this is a human-driven step.

The first developer with platform tooling should run, in order:

```bash
# from the repo root
pnpm install --frozen-lockfile
pnpm --filter @kpu/web build           # produces the bundle Capacitor will load
cd apps/mobile

# 1. add the platforms (one-time, generates ios/ and android/ folders)
npx cap add ios                        # requires macOS + Xcode 15+
npx cap add android                    # requires Android Studio + JDK 17

# 2. drop icons + splash into apps/mobile/assets/ (1024×1024 png each)
#    then generate the per-platform assets:
npx @capacitor/assets generate --iconBackgroundColor '#ffffff' \
  --iconBackgroundColorDark '#0b0b0c' \
  --splashBackgroundColor '#ffffff' \
  --splashBackgroundColorDark '#0b0b0c'

# 3. sync the web build + plugins into the native projects
npx cap sync

# 4. open the IDEs to set bundle id, signing, capabilities, etc.
npx cap open ios
npx cap open android
```

Commit `apps/mobile/ios/` and `apps/mobile/android/` (and the `assets/`
folder) once those steps succeed. Subsequent developers only need
`pnpm install` and `npx cap sync`.

### iOS-specific (Info.plist) entries to add after `cap add ios`

The Camera plugin (Phase 5) needs explicit usage strings. In
`ios/App/App/Info.plist`:

- `NSCameraUsageDescription` — "Take photos to attach to your cards."
- `NSPhotoLibraryUsageDescription` — "Pick photos from your library to
  attach to your cards."
- `NSPhotoLibraryAddUsageDescription` — only if we later enable
  `saveToGallery: true`. Currently disabled.

### Android-specific (AndroidManifest.xml) entries

Capacitor injects the `CAMERA` and `READ_MEDIA_IMAGES` permissions
automatically when `@capacitor/camera` is installed; no manual edits
needed. Verify after `cap sync` that they are present in
`android/app/src/main/AndroidManifest.xml`.

## What's here

- `capacitor.config.ts` — bundle id, name, dev-server toggle.
- `public/` — placeholder asset directory required by `cap sync`. The real
  web bundle is served by Next at dev time and shipped as part of a
  cloud-hosted deployment (or self-hosted) for release.

## What's NOT here yet

- The generated `ios/` and `android/` projects. They land via
  `npx cap add ios` and `npx cap add android`, which require Xcode and
  Android Studio respectively. Run those once per platform from a dev
  machine — the generated folders should be committed.
- Native icons / splash screens (`assets/`). Generated via
  `npx @capacitor/assets generate` once `assets/icon.png` and
  `assets/splash.png` exist.

## First-time setup

From the repo root:

```bash
pnpm install
pnpm --filter @kpu/web build           # produces the bundle Capacitor will load

cd apps/mobile
npx cap add ios                        # macOS + Xcode required
npx cap add android                    # Android Studio required
npx cap sync
```

## Dev loop

Run the web app on your LAN, then point Capacitor at it:

```bash
# Terminal 1: web dev server
pnpm --filter @kpu/web dev -- -H 0.0.0.0

# Terminal 2: open the native shell
cd apps/mobile
KPU_DEV_SERVER=http://<your-lan-ip>:3000 npx cap run ios      # or android
```

## Plugins used by the web bundle

- `@capacitor/haptics` — fires a light impact on drag-pickup and a
  medium impact on drag-drop. Web fallback uses `navigator.vibrate`
  when available.
- `@capacitor/camera` — backs the "Photo" button in the card editor
  modal. Routed through `apps/web/lib/camera.ts`: on a native shell
  (`Capacitor.isNativePlatform()`) it opens the OS camera/library
  prompt; on web it falls back to a hidden `<input type="file"
  accept="image/*">` (which mobile browsers also wire to the OS
  camera via the `capture` attribute).
