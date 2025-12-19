#!/usr/bin/env bash
# Simple sitemap generator for static HTML pages
# - Scans the repo for .html files (excluding tests/build dirs)
# - Emits <url><loc><lastmod> and optional image tags when og:image is present

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT_DIR/sitemap.xml"
BASE_URL="https://abdulkerimsesli.de"

echo "Generating sitemap to: $OUT"

TMP="${OUT}.tmp"
echo '<?xml version="1.0" encoding="UTF-8"?>' > "$TMP"
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' >> "$TMP"

# Find HTML files (exclude node_modules, test-results)
find "$ROOT_DIR" -type f -name '*.html' \
  -not -path '*/node_modules/*' \
  -not -path '*/test-results/*' \
  -not -path '*/.git/*' | sort | while IFS= read -r file; do
  rel="${file#$ROOT_DIR}"
  # Normalize URL path
  if [ "$rel" = "/index.html" ] || [ "$rel" = "/" ]; then
    urlpath="/"
  elif [[ "$rel" =~ /index.html$ ]]; then
    urlpath="${rel%/index.html}/"
  else
    urlpath="$rel"
  fi

  # Ensure leading slash
  case "$urlpath" in
    /*) ;;
    *) urlpath="/$urlpath" ;;
  esac

  # Get last modified date (macOS stat compatible)
  if stat -f '%Sm' -t '%Y-%m-%d' "$file" >/dev/null 2>&1; then
    lastmod=$(stat -f '%Sm' -t '%Y-%m-%d' "$file")
  else
    # fallback for linux
    lastmod=$(date -r "$file" '+%Y-%m-%d')
  fi

  # Extract first og:image (if present) using perl for robust quoting
  og_image=""
  og_image=$(perl -nle 'if (/<meta[^>]*property=["\'\"']og:image["\'\"'][^>]*content=["\'\"']([^"\'\"']+)["\'\"']/i){print $1; exit}' "$file" || true)

  # Heuristics for changefreq/priority
  if [ "$urlpath" = "/" ]; then
    changefreq="weekly"
    priority="1.0"
  elif [[ "$urlpath" =~ ^/blog/ ]]; then
    changefreq="weekly"
    priority="0.8"
  else
    changefreq="monthly"
    priority="0.6"
  fi

  # Write url entry
  echo "  <url>" >> "$TMP"
  echo "    <loc>${BASE_URL}${urlpath}</loc>" >> "$TMP"
  echo "    <lastmod>${lastmod}</lastmod>" >> "$TMP"
  echo "    <changefreq>${changefreq}</changefreq>" >> "$TMP"
  echo "    <priority>${priority}</priority>" >> "$TMP"

  if [ -n "$og_image" ]; then
    # Normalize absolute vs relative
    if [[ "$og_image" =~ ^https?:// ]]; then
      imgurl="$og_image"
    else
      # ensure leading slash
      case "$og_image" in
        /*) imgurl="${BASE_URL}${og_image}" ;;
        *) imgurl="${BASE_URL}/${og_image}" ;;
      esac
    fi
    echo "    <image:image>" >> "$TMP"
    echo "      <image:loc>${imgurl}</image:loc>" >> "$TMP"
    echo "    </image:image>" >> "$TMP"
  fi

  echo "  </url>" >> "$TMP"
done

echo '</urlset>' >> "$TMP"

# Backup existing sitemap
if [ -f "$OUT" ]; then
  cp "$OUT" "$OUT.bak.$(date -u +%Y%m%dT%H%M%SZ)"
fi

mv "$TMP" "$OUT"
echo "Sitemap written to $OUT"

exit 0
