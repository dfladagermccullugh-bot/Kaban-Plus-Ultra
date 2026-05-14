#!/usr/bin/env bash
# Kaban Plus Ultra — Android Play Console (internal track) release plumbing.
#
# Wraps `./gradlew bundleRelease` + an optional `fastlane supply` upload to
# the Play Console's internal-testing track. Usage:
#
#   ANDROID_KEYSTORE=/secure/path/kaban.keystore \
#   ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=kaban \
#   ANDROID_KEY_PASSWORD=… \
#   PLAY_SERVICE_ACCOUNT_JSON=/secure/path/play-service-account.json \
#     ./scripts/release-android.sh
#
# Like its iOS counterpart, this is STAGED — it refuses to run until:
#   (a) `apps/mobile/android/` exists (`npx cap add android` has been run
#       on a machine with Android Studio + SDK), and
#   (b) a release keystore + Play Console service-account JSON are
#       provided via env.
#
# Neither prerequisite is satisfiable inside the agent harness; this
# file exists so the human operator has a concrete starting point on the
# dev machine. `bash -n` clean.

set -euo pipefail

# ---------- config ----------

: "${GRADLE_TASK:=bundleRelease}"
: "${BUILD_VARIANT:=release}"
: "${ANDROID_PROJECT:=apps/mobile/android}"
: "${PACKAGE_NAME:=app.kabanplusultra}"
: "${PLAY_TRACK:=internal}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---------- preflight ----------

say()  { printf '\033[1;36m[release-android]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[release-android] error:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$ANDROID_PROJECT" ] \
  || fail "$ANDROID_PROJECT not found — run \`npx cap add android\` first on a machine with Android Studio."
[ -f "$ANDROID_PROJECT/gradlew" ] \
  || fail "$ANDROID_PROJECT/gradlew missing — Capacitor scaffold incomplete."

: "${ANDROID_KEYSTORE:?must be set — path to the release keystore (.jks / .keystore)}"
: "${ANDROID_KEYSTORE_PASSWORD:?must be set}"
: "${ANDROID_KEY_ALIAS:?must be set}"
: "${ANDROID_KEY_PASSWORD:?must be set}"

[ -f "$ANDROID_KEYSTORE" ] || fail "keystore not readable at $ANDROID_KEYSTORE."

# ---------- build ----------

say "Building web bundle (@kpu/web)…"
pnpm --filter @kpu/web build

say "Syncing Capacitor → Android…"
pnpm --filter @kpu/mobile sync

say "Running ./gradlew $GRADLE_TASK in $ANDROID_PROJECT…"
(
  cd "$ANDROID_PROJECT"
  # Gradle reads signing config from these env vars via app/build.gradle
  # (or a signingConfigs block referencing them). Keeping them per-invocation
  # rather than baking them into gradle.properties means they never hit
  # source control.
  KEYSTORE_FILE="$ANDROID_KEYSTORE" \
  KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD" \
  KEY_ALIAS="$ANDROID_KEY_ALIAS" \
  KEY_PASSWORD="$ANDROID_KEY_PASSWORD" \
    ./gradlew --no-daemon "$GRADLE_TASK"
)

AAB_PATH="$ANDROID_PROJECT/app/build/outputs/bundle/$BUILD_VARIANT/app-$BUILD_VARIANT.aab"
[ -f "$AAB_PATH" ] || fail "expected AAB at $AAB_PATH — check gradle output."

say "AAB ready: $AAB_PATH"

# ---------- upload (optional) ----------

if [ "${PLAY_UPLOAD:-1}" = "0" ]; then
  say "PLAY_UPLOAD=0 — skipping Play Console upload. AAB left at $AAB_PATH."
  exit 0
fi

: "${PLAY_SERVICE_ACCOUNT_JSON:?must be set — JSON key for the Play Console service account}"
[ -f "$PLAY_SERVICE_ACCOUNT_JSON" ] \
  || fail "Play service-account JSON not readable at $PLAY_SERVICE_ACCOUNT_JSON."

if ! command -v fastlane >/dev/null; then
  fail "fastlane not on PATH. Install with \`brew install fastlane\` or \`gem install fastlane\`, then re-run."
fi

say "Uploading $AAB_PATH to Play Console track=$PLAY_TRACK…"
fastlane supply \
  --aab "$AAB_PATH" \
  --package_name "$PACKAGE_NAME" \
  --track "$PLAY_TRACK" \
  --json_key "$PLAY_SERVICE_ACCOUNT_JSON" \
  --skip_upload_metadata true \
  --skip_upload_changelogs true \
  --skip_upload_images true \
  --skip_upload_screenshots true

say "Done. The build will appear on the $PLAY_TRACK track after Play finishes processing (10–30 min)."
