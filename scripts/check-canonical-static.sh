#!/usr/bin/env bash
# Fails if any static <link rel="canonical"> tags exist in top-level html files or pages/*
set -euo pipefail

echo "Checking for static canonical tags..."
# Search for occurrences
if grep -R --line-number -E "<link[[:space:]]+rel=\"canonical\"" index.html pages/ impressum datenschutz offline.html; then
  echo "ERROR: Static canonical tags found. Remove them and rely on dynamic injection by head-complete.js"
  exit 1
else
  echo "OK: No static canonical tags found."
  exit 0
fi
