#!/usr/bin/env bash
# deploy-report-only.sh
# Small helper to show how to enable the Report-Only CSP header for a static host.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Root: $ROOT_DIR"

echo "This script prints suggested actions for deploying the Report-Only header.
It does not perform any remote deploys itself."

echo "
Netlify (example):
1) Add the file 'security/_headers-report-only' into your site's published folder (root) or configure Netlify headers in 'netlify.toml'.
2) Verify in browser DevTools > Network > Headers that the response contains 'Content-Security-Policy-Report-Only'.

Example netlify.toml snippet:

[[_headers]]
for = "/*"
  [[_headers.headers]]
  for = "/"
  values = { "Content-Security-Policy-Report-Only" = "$(cat ${ROOT_DIR}/security/_headers-report-only | sed -n '2p' | sed 's/^  //')" }

Note: the above is only illustrative; adapt the netlify.toml to your CI/CD.
"

echo "Recommended monitoring steps:"
echo "- Open the site in multiple browsers and observe CSP console warnings"
echo "- Optionally configure a reporting endpoint using Report-To + Report-URI to collect violation reports"

exit 0
