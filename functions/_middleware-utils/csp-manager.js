/**
 * CSP (Content Security Policy) Management
 * @version 2.0.0
 */

/**
 * Generate a cryptographically random nonce (base64, 128-bit)
 * @returns {string} Base64-encoded nonce
 */
export function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Build a nonce-bound CSP header.
 * Inline script execution is nonce-gated while external scripts are limited
 * to the required first-party/module/CDN/analytics hosts used by the site.
 *
 * @param {string} nonce
 * @returns {string}
 */
export function buildCspHeader(nonce) {
  const normalizedNonce = String(nonce || "").trim();
  if (!normalizedNonce) return "";
  const nonceSource = `'nonce-${normalizedNonce}'`;
  const cloudflareGoogleTagBootstrapHash = "'sha256-UnHw8EKlqQSvt21NBIRkASjT9PmkkCQjBIUBK+dn2Bk='";
  const cloudflareGoogleTagConfigHash = "'sha256-IJD97QaiL1gr5I9bVDGDNpUdsf4FkdyneF8a1o6cZPk='";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    [
      "script-src",
      "'self'",
      nonceSource,
      // Cloudflare may inject Google Tags first-party bootstrap snippets
      // before our nonced head scripts for browser UAs.
      cloudflareGoogleTagBootstrapHash,
      cloudflareGoogleTagConfigHash,
      "https://www.abdulkerimsesli.de",
      "https://abdulkerimsesli.de",
      "https://cdn.jsdelivr.net",
      "https://esm.sh",
      "https://unpkg.com",
      "https://www.googletagmanager.com",
      "https://static.cloudflareinsights.com",
    ].join(" "),
    "script-src-attr 'none'",
    [
      "style-src",
      "'self'",
      // Cloudflare Fonts may rewrite Google Fonts into a first-party inline
      // stylesheet after our HTMLRewriter pass, so style nonces cannot cover
      // every production style block. Keep scripts nonce-gated; allow inline
      // styles deliberately for edge font rewrites.
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
    ].join(" "),
    "font-src 'self' https://fonts.gstatic.com data:",
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      "https://img.abdulkerimsesli.de",
      "https://i.ytimg.com",
      "https://img.youtube.com",
      "https://www.google-analytics.com",
    ].join(" "),
    [
      "connect-src",
      "'self'",
      "https://www.abdulkerimsesli.de",
      "https://abdulkerimsesli.de",
      "https://www.googleapis.com",
      "https://api.github.com",
      "https://raw.githubusercontent.com",
      "https://www.google-analytics.com",
      "https://region1.google-analytics.com",
      "https://www.googletagmanager.com",
      "https://*.googletagmanager.com",
      "https://www.gstatic.com",
      "https://www.google.com",
      "https://adservice.google.com",
      "https://cct.google",
      "https://static.cloudflareinsights.com",
    ].join(" "),
    [
      "frame-src",
      "'self'",
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
      "https://www.googletagmanager.com",
    ].join(" "),
    "media-src 'self' https://www.youtube.com https://*.googlevideo.com",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

/**
 * Build a report-only CSP header value that points reports to a given URI.
 * Uses the same directives as the enforced CSP and appends a `report-uri`.
 * @param {string} nonce
 * @param {string} [reportUri]
 * @returns {string}
 */
export function buildCspReportOnlyHeader(nonce, reportUri = "/api/csp-report") {
  const base = buildCspHeader(nonce);
  if (!base) return "";
  const normalized = String(reportUri || "").trim();
  const reportOnlyBase = omitCspDirective(base, "frame-ancestors");
  if (!normalized) return reportOnlyBase;
  return `${reportOnlyBase}; report-uri ${normalized}`;
}

function omitCspDirective(policy, directiveName) {
  const normalizedName = String(directiveName || "")
    .trim()
    .toLowerCase();
  if (!normalizedName) return policy;

  return String(policy || "")
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !part.toLowerCase().startsWith(`${normalizedName} `))
    .join("; ");
}
