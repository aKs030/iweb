#!/usr/bin/env bash
set -euo pipefail

# Simple redirect checks for canonicalization
# Usage: ./scripts/check-redirects.sh

urls=(
  "https://www.abdulkerimsesli.de/"
  "https://www.abdulkerimsesli.de/about/"
  "http://www.abdulkerimsesli.de/"
)

failed=0

for u in "${urls[@]}"; do
  echo "Checking $u"
  # Check first response without following redirects to see initial status and Location
  status=$(curl -s -I -o /dev/null -w "%{http_code} %{redirect_url}" "$u")
  code=$(echo "$status" | awk '{print $1}')
  redirect_url=$(echo "$status" | cut -d' ' -f2-)

  if [[ "$code" == "301" || "$code" == "308" ]]; then
    echo "  Redirects: $redirect_url ($code)"
    if [[ "$redirect_url" != https://abdulkerimsesli.de* ]]; then
      echo "  → Redirects to unexpected host: $redirect_url"
      failed=1
    fi
  else
    # Follow redirects to see final destination
    eff=$(curl -s -I -L -o /dev/null -w "%{url_effective} %{http_code}" "$u")
    eff_url=$(echo $eff | awk '{print $1}')
    eff_code=$(echo $eff | awk '{print $2}')
    echo "  Final: $eff_url $eff_code"
    if [[ "$eff_url" != https://abdulkerimsesli.de* ]]; then
      echo "  → Final URL does not use non‑www host: $eff_url"
      failed=1
    fi
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "Some checks failed"
  exit 2
else
  echo "All checks passed"
  exit 0
fi
