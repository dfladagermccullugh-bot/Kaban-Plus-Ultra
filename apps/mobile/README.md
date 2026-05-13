# @kpu/mobile

Capacitor shell that wraps `@kpu/web` for iOS and Android. One TypeScript
codebase, three platforms.

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
