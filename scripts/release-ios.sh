#!/usr/bin/env bash
# Kaban Plus Ultra — iOS TestFlight release plumbing.
#
# Wraps `xcodebuild archive` + `xcodebuild -exportArchive` + `xcrun altool
# --upload-app` so a release looks like:
#
#   APPLE_ID=ci@example.com APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx \
#   TEAM_ID=ABCDE12345 \
#     ./scripts/release-ios.sh
#
# This script is intentionally STAGED — it refuses to run until:
#   (a) `apps/mobile/ios/` exists (`npx cap add ios` has been run on a
#       machine with Xcode), and
#   (b) the Apple Developer account / provisioning profile / signing
#       certificate are wired up in Xcode and exposed via the env vars
#       below.
#
# Neither prerequisite is satisfiable inside the agent harness; this file
# exists so the human operator has a concrete starting point on the dev
# machine. `bash -n` clean.

set -euo pipefail

# ---------- config ----------

: "${SCHEME:=App}"
: "${CONFIGURATION:=Release}"
: "${XCWORKSPACE:=apps/mobile/ios/App/App.xcworkspace}"
: "${ARCHIVE_PATH:=build/ios/App.xcarchive}"
: "${EXPORT_PATH:=build/ios/export}"
: "${EXPORT_OPTIONS_PLIST:=apps/mobile/ios/ExportOptions.plist}"
: "${IPA_NAME:=App.ipa}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---------- preflight ----------

say()  { printf '\033[1;36m[release-ios]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[release-ios] error:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d apps/mobile/ios ] \
  || fail "apps/mobile/ios/ not found — run \`npx cap add ios\` first on a machine with Xcode."
[ -f "$XCWORKSPACE/contents.xcworkspacedata" ] \
  || fail "$XCWORKSPACE missing — Capacitor scaffold incomplete."

command -v xcodebuild >/dev/null || fail "xcodebuild not on PATH (requires macOS + Xcode)."
command -v xcrun      >/dev/null || fail "xcrun not on PATH (requires macOS + Xcode)."

: "${APPLE_ID:?must be set — Apple ID used for App Store Connect upload}"
: "${APP_SPECIFIC_PASSWORD:?must be set — generate at appleid.apple.com}"
: "${TEAM_ID:?must be set — 10-char team ID from developer.apple.com}"

[ -f "$EXPORT_OPTIONS_PLIST" ] \
  || fail "$EXPORT_OPTIONS_PLIST not found. Create it with method=app-store, teamID=$TEAM_ID, signingStyle=automatic."

# ---------- build ----------

say "Building web bundle (@kpu/web)…"
pnpm --filter @kpu/web build

say "Syncing Capacitor → iOS…"
pnpm --filter @kpu/mobile sync

say "Archiving (scheme=$SCHEME, configuration=$CONFIGURATION)…"
rm -rf "$ARCHIVE_PATH"
xcodebuild \
  -workspace "$XCWORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  clean archive

say "Exporting IPA → $EXPORT_PATH/$IPA_NAME…"
rm -rf "$EXPORT_PATH"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates

IPA_PATH="$EXPORT_PATH/$IPA_NAME"
[ -f "$IPA_PATH" ] || fail "expected $IPA_PATH after export — check ExportOptions.plist."

# ---------- upload ----------

say "Uploading to App Store Connect (TestFlight)…"
xcrun altool \
  --upload-app \
  --type ios \
  --file "$IPA_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID"

say "Done. The build will appear in TestFlight after Apple finishes processing (5–30 min)."
