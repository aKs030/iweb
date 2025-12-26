#!/usr/bin/env bash
set -euo pipefail

THREE_VERSION="0.155.0"
OUT_DIR="content/vendor/three"
OUT_FILE="$OUT_DIR/three.module.js"

mkdir -p "$OUT_DIR"

URL="https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js"

echo "Fetching Three.js ${THREE_VERSION} from ${URL}"

curl -fSL "$URL" -o "$OUT_FILE"

if [[ -s "$OUT_FILE" ]]; then
  echo "Saved Three.js to $OUT_FILE (size: $(wc -c < "$OUT_FILE") bytes)"
else
  echo "Download failed or file empty" >&2
  exit 2
fi

echo "Note: Review license and commit vendor file if desired. For CI, you can run scripts/fetch_three.sh during the build step."