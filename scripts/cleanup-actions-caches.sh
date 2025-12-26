#!/usr/bin/env bash
set -euo pipefail

API="https://api.github.com/repos/aKs030/iweb/actions/caches"

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

ids=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "$API" | jq -r '.actions_caches // [] | .[].id')

if [ -z "$ids" ]; then
  echo "Keine Actions-Caches gefunden."
  exit 0
fi

echo "Gefundene Cache-IDs:"
curl -s -H "Authorization: token $GITHUB_TOKEN" "$API" | jq '.actions_caches[] | {id,key,size_in_bytes}'

read -p "Möchtest du alle löschen? (yes/no) " ans
if [ "$ans" != "yes" ]; then
  echo "Abgebrochen."
  exit 0
fi

for id in $ids; do
  curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" "$API/$id" && echo "Deleted $id"
done
