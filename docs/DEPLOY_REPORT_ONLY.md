# Deploying Content-Security-Policy in Report-Only mode

This document explains how to deploy the existing `security/_headers-report-only` into your hosting environment so you can monitor CSP violations without blocking resources.

1) Goal
   - Apply `Content-Security-Policy-Report-Only` to observe what would be blocked.

2) Where the file is
   - Repository file: `security/_headers-report-only` (contains a header-friendly block with the Report-Only policy).

3) How to deploy (examples)
   - Netlify: add `_headers` file to the publish root (or reference via `netlify.toml`) — ensure the file contains the `Content-Security-Policy-Report-Only` header line.
   - Nginx: add a temporary `add_header Content-Security-Policy-Report-Only "..." always;` in your server config (reload nginx after change).

4) Optional: Configure report collection
   - Add a `Report-To` header and a reporting endpoint OR use `report-uri` (deprecated in some specs but widely supported).
   - Example (nginx):
     add_header Report-To '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://example.com/csp-report"}]}' always;
     add_header Content-Security-Policy-Report-Only "default-src 'self'; report-to csp-endpoint" always;

5) Monitoring checklist (first 72 hours)
   - Check DevTools Console for CSP warnings (they will appear as non-blocking violations).
   - If you have a report endpoint, inspect received reports for unexpected blocked origins or inline content.
   - For each violation decide: move to external resource / compute sha256 hash and add to CSP / allow via nonce or remove the inline code.

6) After a clean testing window
   - If no unexpected violations are observed for ~48–72 hours, consider switching to the enforcing header (deploy `_headers` / `security/_headers`).

7) Rollback
   - Remove the Report-Only header from your host or revert the change in your CI/CD config.

If you want, I can open a PR that contains a short commit applying `security/_headers-report-only` to the publish root (or CI config) so you can review it before deployment.
