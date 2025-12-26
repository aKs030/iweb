# Security & Cache Headers — Recommendations and Deployment

This document explains what headers we enforce and how to deploy them using Cloudflare (or at the IONOS origin).

## What we set in the CDN (Cloudflare Worker)

- Strict-Transport-Security: `max-age=31536000; includeSubDomains; preload` ✅
- X-Content-Type-Options: `nosniff` ✅
- Referrer-Policy: `strict-origin-when-cross-origin` ✅
- Content-Security-Policy: default example provided — adapt to your third-party needs ✅
- X-Frame-Options: `DENY` ✅
- Permissions-Policy: restrict camera/microphone/geolocation ✅

Also: for static assets under `/content/assets/` and typical file extensions we set a long Cache-Control TTL (`public, max-age=31536000, immutable`).

## Cloudflare deployment options

1) Quick (no code): Use Cloudflare Dashboard → Rules → Transform Rules → Response Header Modification to add the headers above.

2) Flexible & versioned (recommended): Deploy the provided Worker at `cloudflare/workers/headers.js`. A GitHub Actions workflow template is included at `.github/workflows/deploy-cloudflare-worker.yml`.

### GitHub Actions / Wrangler
- Add `CF_API_TOKEN` and `CF_ACCOUNT_ID` as repository secrets. The workflow will replace `YOUR_ACCOUNT_ID` in `wrangler.toml` at runtime and call `wrangler publish`.

## IONOS origin suggestions

Set Cache-Control headers for static assets at origin (e.g., via `.htaccess` or server config):

Example `.htaccess` snippet (Apache):

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\.(png|jpe?g|gif|svg|css|js)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>

> Note: Set `Strict-Transport-Security` header at the edge (Cloudflare) if you have a valid TLS setup; it's safe to also set it at origin.

## Tests

- Playwright tests were added in `tests/security-headers.spec.js` to assert presence of HSTS, CSP, and caching for assets. The tests run against `TEST_BASE_URL` (defaults to `http://localhost:8081`).

## Next steps

- Deploy the worker to Cloudflare or create Transform Rules in the dashboard.
- Ensure IONOS origin sets Cache-Control for assets, or let the worker set it for requests it handles.
- Run the Playwright tests against a staging or production URL by setting `TEST_BASE_URL` in CI.
