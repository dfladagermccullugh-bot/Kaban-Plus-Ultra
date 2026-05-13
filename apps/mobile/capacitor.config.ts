import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Kaban Plus Ultra mobile shell.
 *
 * For local dev, point `server.url` at the running `apps/web` dev server
 * (`http://<your-lan-ip>:3000`) via the `KPU_DEV_SERVER` env var. For
 * release builds, leave `KPU_DEV_SERVER` unset — Capacitor will load the
 * static `webDir` instead, which we point at the Next standalone output
 * (`apps/web/.next/standalone/public`) after running `pnpm build:web`.
 *
 * `webDir` is required by `cap sync` even when `server.url` is set; we
 * keep `public/` as a stable placeholder so `cap sync` runs in CI without
 * needing a full web build.
 */
const config: CapacitorConfig = {
  appId: 'app.kabanplusultra',
  appName: 'Kaban Plus Ultra',
  webDir: 'public',
  server: process.env.KPU_DEV_SERVER
    ? { url: process.env.KPU_DEV_SERVER, cleartext: true }
    : undefined,
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
