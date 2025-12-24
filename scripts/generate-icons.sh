#!/usr/bin/env bash
set -euo pipefail

# generate-icons.sh
# Erzeugt favicons, apple-touch-icons, png- und webp-Icons in content/assets/img/icons/
# Nutzung: ./scripts/generate-icons.sh /path/to/source.jpg

SRC=${1:-}
OUT_DIR="content/assets/img/icons"
mkdir -p "$OUT_DIR"

if [ -z "$SRC" ]; then
  echo "Usage: $0 /path/to/source.jpg"
  exit 2
fi

if [ ! -f "$SRC" ]; then
  echo "Source file not found: $SRC"
  exit 3
fi

# Tools detection
if command -v magick >/dev/null 2>&1; then
  IM_CMD=magick
elif command -v convert >/dev/null 2>&1; then
  IM_CMD=convert
else
  IM_CMD=""
fi

has_pngquant=false
if command -v pngquant >/dev/null 2>&1; then
  has_pngquant=true
fi

has_cwebp=false
if command -v cwebp >/dev/null 2>&1; then
  has_cwebp=true
fi

sizes=(16 32 48 64 96 120 128 152 167 180 192 256 384 512 1024)

echo "Generating icons in $OUT_DIR"

for s in "${sizes[@]}"; do
  out_png="$OUT_DIR/icon-${s}.png"
  if [ -n "$IM_CMD" ]; then
    $IM_CMD "$SRC" -auto-orient -resize ${s}x${s}^ -gravity center -background transparent -extent ${s}x${s} png:"$out_png"
  else
    # fallback to sips (macOS built-in) — may not crop exactly, keeps aspect ratio
    sips -Z $s "$SRC" --out "$out_png" >/dev/null
  fi

  if [ "$has_pngquant" = true ]; then
    tmp="${out_png%.png}-pq.png"
    pngquant --quality=60-90 --speed 1 --output "$tmp" --force "$out_png" && mv "$tmp" "$out_png" || true
  fi

  if [ "$has_cwebp" = true ]; then
    out_webp="$OUT_DIR/icon-${s}.webp"
    cwebp -q 85 "$out_png" -o "$out_webp" >/dev/null || true
  fi
done

# Create favicon.ico (include common small sizes)
if [ -n "$IM_CMD" ]; then
  ico_inputs=()
  for s in 16 32 48; do
    ico_inputs+=("$OUT_DIR/icon-${s}.png")
  done
  echo "Creating favicon.ico"
  $IM_CMD "${ico_inputs[@]}" -background transparent -alpha remove -alpha off "$OUT_DIR/favicon.ico"
else
  echo "ImageMagick not found — skipping favicon.ico creation (install imagemagick to enable)."
fi

# Create apple-touch-icon (180x180) and manifest icon (512x512)
if [ -f "$OUT_DIR/icon-180.png" ]; then
  cp "$OUT_DIR/icon-180.png" "$OUT_DIR/apple-touch-icon.png"
fi
if [ -f "$OUT_DIR/icon-512.png" ]; then
  cp "$OUT_DIR/icon-512.png" "$OUT_DIR/icon-512-manifest.png"
fi

echo "Done. Icons written to $OUT_DIR"

echo "Summary (first 20 files):"
ls -1 "$OUT_DIR" | sed -n '1,20p'

cat <<'EOF'
Tip:
- Run: chmod +x scripts/generate-icons.sh
- Then: ./scripts/generate-icons.sh /path/to/unnamed.jpg
- Wenn Sie möchten, kopieren Sie die Quelldatei vorher nach content/assets/img/icons/unnamed-src.jpg
- Installieren (optional) für bessere Optimierung: ImageMagick, pngquant, cwebp
EOF
