# 0019. Phase 8 — release CI workflows, ExportOptions.plist template, and store listing copy

- **Date**: 2026-05-14
- **Status**: accepted

## Context

ADR 0018 landed the agent-tractable Phase 8 prep: source SVG launch
assets, staged `release-{ios,android}.sh` scripts, and a draft
`/legal/privacy` page. Three concrete follow-ups were left for this
session — none of them unblock a real TestFlight / Play upload (still
gated on Apple Developer + Play Console accounts + Xcode + Android
Studio on a dev machine), but all three shorten the dev-machine session
that does:

1. A filled `ExportOptions.plist` template at
   `apps/mobile/ios/ExportOptions.plist` so the iOS export step doesn't
   wait on a hand-written plist on the dev machine.
2. GitHub Actions workflow shells that wrap `scripts/release-ios.sh` and
   `scripts/release-android.sh`, so a tag or manual dispatch can drive
   the release once secrets are wired.
3. App Store + Play Store listing copy drafts (description, keywords,
   subtitle, support / marketing URLs), so the human's first listing
   pass is a copy-edit rather than a from-scratch write.

## Decision

**`apps/mobile/ios/ExportOptions.plist`** is committed as a literal
plist with `method=app-store`, `signingStyle=automatic`, and
`teamID=$TEAM_ID` as a placeholder string. The release workflow runs a
`sed -i ''` substitution from a secret before `xcodebuild -exportArchive`.
The directory is pre-created (with a `.gitkeep`) so the plist has a
home before `npx cap add ios` runs; `scripts/release-ios.sh`'s second
preflight check (`$XCWORKSPACE/contents.xcworkspacedata`) still catches
the missing Xcode workspace with an accurate error.

**`.github/workflows/release-ios.yml`** and `release-android.yml` are
`workflow_dispatch`-only. The `release.published` trigger lines are
present but commented out — we flip them on after the first manual
TestFlight / Play upload succeeds, so a CI run never *first* discovers a
broken signing setup against a real release event. Both workflows
preflight-check that the native project folder exists before checking
out, so they fail fast with a clear `::error::` message rather than
running `pnpm install` and discovering the gap deep into the job. The
Android workflow materialises the keystore (base64 secret → file in
`$RUNNER_TEMP`) and the Play service-account JSON (raw secret → file)
exactly once and exports the paths via `$GITHUB_ENV` so the existing
release script (which expects file paths, not contents) runs unchanged.

**`docs/STORE_LISTING.md`** ships both the App Store and the Play Store
listings in one file. Every length budget is the actual store cap;
sentence lengths were verified by hand. Contact addresses, support /
marketing URLs, and the canonical domain are flagged as placeholders for
the operator; the page closes with a checklist of those open items so a
review session can sweep them in one pass.

## Alternatives considered

- **Commit the secret-substituted plist in CI by templating at
  build time** (e.g. via `envsubst` against a `.tmpl` file). Rejected —
  a literal `$TEAM_ID` string in a real plist still parses as valid XML
  for tooling, and the single `sed` line in the workflow is easier to
  audit than another templating dependency.
- **Single unified `release.yml` workflow with an `ios` / `android`
  matrix.** Rejected for the same reason ADR 0018 split the shell
  scripts: iOS needs `macos-14`, Android runs cheaper on
  `ubuntu-latest`, and the two require disjoint secret sets. Folding
  them costs more in YAML conditionals than it saves in duplication.
- **Wait to draft listing copy until screenshots are captured.**
  Rejected — the wordsmithing is the slow part, and the copy length caps
  influence what each screenshot needs to convey. Better to land draft
  copy now and treat screenshots as a separate human-driven pass.
- **Auto-trigger the release workflows on `release.published`.**
  Rejected for v1 — the first signed build will inevitably surface a
  signing / provisioning gap, and discovering that against a real
  GitHub release event is a worse failure mode than discovering it via
  `workflow_dispatch`. Flip the triggers on after the first manual
  success.

## Consequences

- The dev-machine session can: drop `TEAM_ID` (and the iOS / Android
  signing secrets) into the GitHub Actions environment, `npx cap add
  ios|android`, `pnpm --filter @kpu/mobile generate:assets`, commit, and
  then run **Actions → Release iOS / Release Android → Run workflow**
  from the GitHub UI — no shell access to a release runner required.
- The listing copy lives in `docs/`, so it survives store-listing
  rewrites by the operator and tracks alongside `RELEASE_NOTES_1.0.md`
  in the same review pass.
- Three new placeholders (`support@`, `security@`, `privacy@`, plus the
  canonical domain) are now duplicated across the privacy page,
  `RELEASE_NOTES_1.0.md`, and `STORE_LISTING.md`. The operator
  sign-off pass needs to update all three in one go; flagged in the
  STORE_LISTING checklist.
- The ExportOptions.plist is committed even though `apps/mobile/ios/`
  is otherwise generated. The trade-off is one tracked file vs. a
  dev-machine instruction to hand-author a plist; the file is small and
  diff-friendly so the cost is low.
