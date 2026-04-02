#!/usr/bin/env bash
# Build a standalone binary for the current platform.
# Cross-compilation is handled by GitHub Actions (see .github/workflows/release.yml).
set -euo pipefail

ENTRY="src/index.tsx"
OUT_DIR="dist"
NAME="env-diff"

mkdir -p "$OUT_DIR"

# Detect current platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "${OS}-${ARCH}" in
  linux-x86_64)   TARGET="bun-linux-x64";    ARTIFACT="${NAME}-linux-x64" ;;
  linux-aarch64)  TARGET="bun-linux-arm64";  ARTIFACT="${NAME}-linux-arm64" ;;
  darwin-x86_64)  TARGET="bun-darwin-x64";   ARTIFACT="${NAME}-darwin-x64" ;;
  darwin-arm64)   TARGET="bun-darwin-arm64"; ARTIFACT="${NAME}-darwin-arm64" ;;
  *)
    echo "Unsupported platform: ${OS}-${ARCH}"
    echo "Cross-compilation is not supported. Use 'bun run build' in GitHub Actions instead."
    exit 1
    ;;
esac

echo "→ Building ${ARTIFACT} (${TARGET})..."
bun build "$ENTRY" \
  --compile \
  --minify \
  --sourcemap \
  --target="$TARGET" \
  --outfile="${OUT_DIR}/${ARTIFACT}"

echo ""
echo "✓ ${OUT_DIR}/${ARTIFACT}"
ls -lh "${OUT_DIR}/${ARTIFACT}"
