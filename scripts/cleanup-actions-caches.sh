#!/usr/bin/env bash
set -euo pipefail

# Usage:
#  ./cleanup-actions-caches.sh [--dry-run] [--json-output file.json] [--yes]
#
# By default the script is interactive and will prompt before deleting.
# --dry-run: only lists caches (no deletion)
# --json-output FILE: write the full actions_caches JSON to FILE
# --yes: skip the interactive confirmation (use with care)

API="https://api.github.com/repos/aKs030/iweb/actions/caches"
DRY_RUN=0
JSON_OUTPUT=""
ASSUME_YES=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --json-output)
      JSON_OUTPUT="$2"
      shift 2
      ;;
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --help|-h)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      exit 2
      ;;
  esac
done

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN nicht gesetzt"
  exit 1
fi

http_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" "$API")
if [ "$http_code" != "200" ]; then
  echo "API antwortet mit HTTP $http_code"
  curl -s -H "Authorization: token $GITHUB_TOKEN" "$API" | jq .
  exit 1
fi

# Fetch the full cache list for optional JSON output
cache_json=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "$API" )

if [ -n "$JSON_OUTPUT" ]; then
  echo "$cache_json" > "$JSON_OUTPUT"
  echo "Wrote cache JSON to $JSON_OUTPUT"
fi

ids=$(echo "$cache_json" | jq -r '.actions_caches // [] | .[].id')

if [ -z "$ids" ]; then
  echo "Keine Actions-Caches gefunden."
  exit 0
fi

echo "Gefundene Caches:"
echo "$cache_json" | jq '.actions_caches[] | {id,key,size_in_bytes}'

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run: keine Caches werden gelöscht."
  exit 0
fi

# If non-interactive, require ASSUME_YES or CONFIRM env var set to 'DELETE' for safety
if [ "$ASSUME_YES" -ne 1 ] && [ "${CONFIRM:-}" != "DELETE" ]; then
  read -p "Möchtest du alle löschen? Tippe 'DELETE' zum Bestätigen: " ans
  if [ "$ans" != "DELETE" ]; then
    echo "Abgebrochen."
    exit 0
  fi
fi

for id in $ids; do
  curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" "$API/$id" && echo "Deleted $id"
done
