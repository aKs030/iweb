#!/usr/bin/env bash
set -euo pipefail

# Small repo cleanup script — removes common local build artifacts.
# Use with caution: this deletes local files/directories.

echo "Cleaning local artifacts..."
rm -rf node_modules .vite .vite-temp dist coverage .cache .parcel-cache .turbo

echo "Done."