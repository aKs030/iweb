#!/usr/bin/env sh
# generate-favicon.sh
# Simple helper to (re)create favicon.ico from a PNG source using ImageMagick's `convert`.
# Usage: ./scripts/generate-favicon.sh content/assets/img/icons/icon-32.png

SRC=${1:-content/assets/img/icons/icon-32.png}
DEST=favicon.ico

if ! command -v convert >/dev/null 2>&1; then
  echo "Error: ImageMagick 'convert' command not found. Install ImageMagick (brew install imagemagick) or use an online tool like https://favicon.io"
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "Source file not found: $SRC"
  exit 2
fi

# Create multi-size ICO (ImageMagick supports multiple sizes in one .ico)
convert "$SRC" -define icon:auto-resize=64,48,32,16 "$DEST"
if [ $? -eq 0 ]; then
  echo "Created $DEST successfully. Add /favicon.ico to your site root and verify in the browser."
else
  echo "Failed to create $DEST"
  exit 3
fi
