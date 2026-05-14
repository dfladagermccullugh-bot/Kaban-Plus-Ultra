# 0018. Phase 8 prep — launch assets + staged release scripts + privacy page

- **Date**: 2026-05-14
- **Status**: accepted

## Context

Phase 7 is feature-complete; Phase 8 (store submission) is gated almost
entirely on accounts and assets only a human can provide (Apple Dev
program, Play Console, Xcode/Android Studio, marketing copy +
screenshots, privacy-policy URL). The agent harness has none of those,
but it *can* land the prerequisite scaffolding so the human's first
session on the dev machine is short.

Three pieces of scaffolding land this session:

1. **Source SVG launch assets** for the iOS / Android icon and splash
   under `apps/mobile/assets/`, wired to `@capacitor/assets` via
   `pnpm generate:assets`.
2. **Release plumbing scripts** for TestFlight (`xcrun altool`) and the
   Play Console Internal track (`gradle bundleRelease` + optional
   `fastlane supply`).
3. **`/legal/privacy` page** — a real Next.js route stubbed from
   `docs/SECURITY.md` content, so we have a publishable URL the moment
   the human signs off on it.

## Decision

**Launch assets** are authored as SVG, not PNG. One source file per
role: `icon-only.svg` (iOS app icon), `icon-foreground.svg` +
`icon-background.svg` (Android adaptive layers), `splash.svg`,
`splash-dark.svg`. The generator (`@capacitor/assets@3`) is invoked
via `npx --yes` rather than added to `apps/mobile/devDependencies`
because the package isn't useful until real native projects exist
(`apps/mobile/ios/`, `apps/mobile/android/`) and adding it to the
workspace would force a lockfile bump for a build step nobody can run
yet.

**Release scripts** (`scripts/release-ios.sh`, `release-android.sh`) are
*staged* — they `bash -n` clean and refuse to run with a clear error
when the native projects or signing material are missing. Both gate on
explicit env vars (`APPLE_ID` + `APP_SPECIFIC_PASSWORD` + `TEAM_ID` for
iOS; `ANDROID_KEYSTORE` + `..._PASSWORD` + `KEY_ALIAS` + `KEY_PASSWORD`
+ `PLAY_SERVICE_ACCOUNT_JSON` for Android). Neither persists secrets to
the filesystem.

**Privacy page** is a server-rendered Next.js route at
`apps/web/app/legal/privacy/page.tsx`, marked clearly as a draft in-page
and footer-linked from `/`. Content tracks `docs/SECURITY.md` so any
future security-doc update has an obvious place to ripple.

## Alternatives considered

- **Author icons in PNG directly.** Rejected — locks us out of cheap
  edits, doubles repo size, and `@capacitor/assets` accepts SVG
  natively (rasterizes per-platform at generation time).
- **Add `@capacitor/assets` to `apps/mobile/devDependencies`.** Rejected
  for now — bumps the lockfile for a tool the harness can never invoke
  successfully. Keeping it `npx --yes` means the dev-machine session
  pays a one-time fetch cost and the workspace install stays lean.
- **One unified `release.sh` with `--ios` / `--android` flags.**
  Rejected — the iOS path needs macOS + Xcode and the Android path
  needs JDK + Gradle. Splitting them keeps each script's preflight
  honest and means a Linux CI runner can run the Android half without
  even reading the iOS half.
- **Skip the privacy page until Phase 8.** Rejected — `/legal/privacy`
  is a hard prerequisite for the App Store review, and the security doc
  already covers most of the substance. Better to have a reviewable
  draft now than a panicked sprint later.

## Consequences

- The next dev-machine session can: `npx cap add ios && npx cap add
  android`, then `pnpm --filter @kpu/mobile generate:assets`, then
  `scripts/release-{ios,android}.sh` once signing material is in env.
- The privacy page is route-discoverable today, so a Lighthouse a11y /
  perf pass on the dev-machine session can include it in the route
  matrix.
- The `npx --yes @capacitor/assets@3` invocation pins a major; we
  re-evaluate at the next major bump.
- The release scripts deliberately do not back themselves with a
  CI workflow file — that comes after a real TestFlight / Play upload
  has happened by hand at least once, so we know exactly which steps
  the CI runner needs.
- Privacy page contact addresses (`privacy@`, `security@`) and the
  operator name are placeholders until the human signs off. The page
  carries a visible "stub status" banner so a casual visitor doesn't
  mistake it for the canonical version.
