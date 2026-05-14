#!/usr/bin/env bash
# Build a multi-arch (linux/amd64 + linux/arm64) image of kaban-web via
# `docker buildx`. Useful for:
#
#   - Publishing a single tag that runs on Raspberry-Pi-class ARM64 hosts
#     as well as commodity amd64 VPS hardware.
#   - Cross-compiling on a developer laptop (Apple Silicon → amd64, or
#     amd64 → arm64) without spinning up a foreign-arch VM by hand.
#
# Requires:
#   - Docker Engine ≥ 24 with the `buildx` plugin and a `docker-container`
#     driver builder. The script creates one (`kaban-builder`) on first
#     run if none is already in use.
#   - QEMU user-mode static binaries registered with binfmt_misc — on a
#     fresh host run:
#         docker run --privileged --rm tonistiigi/binfmt --install all
#     once. The script attempts this automatically (idempotent) if it
#     can't already build a foreign-arch tag.
#
# Usage:
#   ./scripts/build-multiarch.sh                            # builds, doesn't push
#   ./scripts/build-multiarch.sh --push -t ghcr.io/you/kaban-web:0.7
#   PLATFORMS=linux/arm64 ./scripts/build-multiarch.sh      # ARM64-only
#
# Pass any `--build-arg NEXT_PUBLIC_…=…` you'd pass to `docker build`;
# they're forwarded to buildx.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILDER="${BUILDER:-kaban-builder}"
TAG_DEFAULT="kaban-web:multiarch"

# ---- prereqs ----
if ! docker buildx version >/dev/null 2>&1; then
  echo "[build-multiarch] 'docker buildx' is missing — install Docker ≥ 24." >&2
  exit 1
fi

# Ensure a docker-container builder exists (the default `docker` driver
# can't push multi-arch manifests).
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  echo "[build-multiarch] creating buildx builder '$BUILDER' …"
  docker buildx create --name "$BUILDER" --driver docker-container --use >/dev/null
else
  docker buildx use "$BUILDER" >/dev/null
fi
docker buildx inspect --bootstrap >/dev/null

# Register QEMU emulators if we need them — idempotent, no-op when already
# installed. Skipped when only the host arch is requested.
if [[ "$PLATFORMS" == *,* ]] || [[ "$PLATFORMS" != *"$(uname -m | sed s/x86_64/amd64/)"* ]]; then
  echo "[build-multiarch] ensuring QEMU binfmt handlers are registered …"
  docker run --privileged --rm tonistiigi/binfmt --install all >/dev/null 2>&1 || true
fi

# ---- args ----
push=0
tag=""
extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    --push)         push=1; shift ;;
    -t|--tag)       tag="$2"; shift 2 ;;
    --tag=*)        tag="${1#*=}"; shift ;;
    *)              extra+=("$1"); shift ;;
  esac
done
tag="${tag:-$TAG_DEFAULT}"

output_flag="--load"
if [ "$push" = 1 ]; then
  output_flag="--push"
elif [[ "$PLATFORMS" == *,* ]]; then
  # `--load` only works for single-platform builds. Without --push there's
  # nowhere for a multi-arch manifest to live, so use the local cache.
  output_flag="--output=type=cacheonly"
  echo "[build-multiarch] multi-platform build without --push → cache-only output."
fi

echo "[build-multiarch] building $tag for $PLATFORMS …"
cd "$REPO_ROOT"
docker buildx build \
  --builder "$BUILDER" \
  --platform "$PLATFORMS" \
  -f docker/Dockerfile.web \
  -t "$tag" \
  $output_flag \
  "${extra[@]}" \
  .

echo "[build-multiarch] done."
