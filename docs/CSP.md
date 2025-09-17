Content Security Policy (CSP) guide
=================================

Final status (2025-09-17):

- Runtime-injected `<style>` elements have been removed by extracting transition and artwork styles into external CSS files.
- `style-src 'unsafe-inline'` was temporarily used during development and has now been removed from `_headers`, `security/_headers`, and `security/security-headers.conf`.
- Inline JSON-LD remains allowed via explicit `sha256-...` tokens. These tokens are listed below and were added to `script-src`.

This repository ships a strict CSP in `_headers` and `security/_headers` for static hosting and in `security/security-headers.conf` for server configs.

Quick summary and recommended hardening steps:

1) Replace `'unsafe-inline'` with script/style hashes where possible.
   - Use `node scripts/compute-csp-hash.js --text "<your inline script>"` to compute a sha256 hash for the exact inline content.
   - Add the resulting `sha256-...` token to `script-src` or `style-src` in your CSP.

2) Prefer nonces for dynamically generated inline scripts.
   - Generate a cryptographically random nonce per request and add it to the CSP header as `'nonce-<base64>'` and to `<script nonce="...">` elements.

3) Limit external hosts to exact origins you trust (we added `https://static.cloudflareinsights.com` for Cloudflare Insights).

4) Consider keeping JSON-LD inline but hashed (compute hash once) or move JSON-LD to an external file and serve it with `application/ld+json`.

5) Use `Content-Security-Policy-Report-Only` first to validate changes without enforcing.

Example: compute sha256 for an inline JSON-LD and add to CSP

  node scripts/compute-csp-hash.js --text "{\"@context\":\"https://schema.org\"...}"
  => sha256-ABCD1234... (add that token to script-src)

Notes:

Generated hashes for current inline JSON-LD blocks (created with `node scripts/compute-csp-hash.cjs <file>`):

- `scripts/csp-inline/creativework.jsonld` => sha256-K9WmLnXZNonKm1ZThJXtTdZa01o72qlCk4TRxkUq1xw=
- `scripts/csp-inline/faq.jsonld` => sha256-3/tZpFDa7mZ0bMj3Z/vnn9t7rm57FDcbV1P+mqgRjJc=
- `scripts/csp-inline/person.jsonld` => sha256-5quy27/OlecHHnU7BVxn3EAwEiSxslEPcPWRsGTms8c=
- `scripts/csp-inline/professional-service.jsonld` => sha256-2T1B6WHceR3weWPsi+cTt0B9SaXiaT85uMNHQD8YHtA=
- `scripts/csp-inline/website.jsonld` => sha256-bxyjtbqvaCRoPbsWM9cB1EZSl6UoxpKFelUYImysCZU=

- `scripts/csp-inline/person.jsonld` => sha256-5quy27/OlecHHnU7BVxn3EAwEiSxslEPcPWRsGTms8c=
- `scripts/csp-inline/website.jsonld` => sha256-bxyjtbqvaCRoPbsWM9cB1EZSl6UoxpKFelUYImysCZU=
- `scripts/csp-inline/professional-service.jsonld` => sha256-2T1B6WHceR3weWPsi+cTt0B9SaXiaT85uMNHQD8YHtA=
- `scripts/csp-inline/faq.jsonld` => sha256-3/tZpFDa7mZ0bMj3Z/vnn9t7rm57FDcbV1P+mqgRjJc=
- `scripts/csp-inline/creativework.jsonld` => sha256-K9WmLnXZNonKm1ZThJXtTdZa01o72qlCk4TRxkUq1xw=

These tokens were added to `script-src` in `_headers`, `security/_headers` and `security/security-headers.conf` so that inline JSON-LD is allowed without `unsafe-inline` for scripts.

Change log:

 2025-09-17: Rewrote all JSON-LD files to private/professional wording and regenerated CSP hashes. New tokens were added to header files.

Next recommended step: remove `style-src 'unsafe-inline'` by moving inline styles to external CSS or computing style hashes as above.

Testing with Report-Only

1) Deploy `security/_headers-report-only` (or translate into your host's header format) so the browser receives `Content-Security-Policy-Report-Only` instead of `Content-Security-Policy`.
2) Open the website in different browsers and check DevTools Console for CSP warnings. No resources will be blocked, but you will see what *would* be blocked.
3) Address each report: either add the appropriate `sha256-...` token (for static inline content) or move the snippet to an external resource.
4) When reports are clean for a few days/traffic cycles, switch the header to the enforcing `Content-Security-Policy` variant (the files `_headers` / `security/_headers` already contain the enforcing header if you want to deploy it).

Quick sequence I recommend:

Removal of `style-src 'unsafe-inline'`
------------------------------------

I removed the remaining inline style attributes found in the repository (notably the SVG sprite) and replaced them with a CSS class (`.svg-sprite-hidden`) defined in `content/webentwicklung/root.css`.

After that change, `style-src 'unsafe-inline'` was removed from the CSP in `_headers`, `security/_headers`, and `security/security-headers.conf`. A final repo-wide grep shows no `style="` occurrences aside from the `security-scan.js` regex used for scanning.

If you later add inline styles, either avoid them or compute `sha256-...` tokens for those blocks or use nonces.

