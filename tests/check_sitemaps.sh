#!/usr/bin/env bash
set -euo pipefail

# Run generator in dry-run mode; prefer API mode if key is present
if [ -n "${YT_API_KEY:-}" ]; then
  python3 scripts/generate_video_sitemaps.py --source api --dry-run > /tmp/sitemap-dryrun.txt
  # check for view_count from API
  if grep -q '<video:view_count>' /tmp/sitemap-dryrun.txt; then
    echo "OK: view_count present"
  else
    echo "FAIL: view_count missing (API mode)"
    exit 2
  fi
else
  echo "No YT_API_KEY - running local dry-run (will not check view_count)"
  python3 scripts/generate_video_sitemaps.py --source local --dry-run > /tmp/sitemap-dryrun.txt
fi

if grep -q '<video:likes>' /tmp/sitemap-dryrun.txt; then
  echo "FAIL: likes field should not be present"
  exit 3
else
  echo "OK: likes absent"
fi

echo "Dry-run checks passed"