#!/usr/bin/env bash
# Export Webgame apps for moving to https://github.com/aKs030/Webgame.git
# Usage: ./scripts/export_webgame.sh
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
APPS_DIR="$ROOT_DIR/pages/projekte/apps"
OUT_ZIP="$ROOT_DIR/webgame-export-$(date +%Y%m%d%H%M%S).zip"

if [ ! -d "$APPS_DIR" ]; then
  echo "Apps directory not found: $APPS_DIR" >&2
  exit 1
fi

pushd "$APPS_DIR" >/dev/null
zip -r "$OUT_ZIP" . -q
popd >/dev/null

echo "Export created: $OUT_ZIP"
