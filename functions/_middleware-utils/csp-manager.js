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
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Build a nonce-bound CSP header.
 * Script execution is nonce-gated while still allowing required third-party
 * module/CDN hosts used by the site.
 *
 * @param {string} nonce
 * @returns {string}
 */
export function buildCspHeader(nonce) {
  const normalizedNonce = String(nonce || '').trim();
  if (!normalizedNonce) return '';
  const nonceSource = `'nonce-${normalizedNonce}'`;

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    [
      'script-src',
      "'self'",
      nonceSource,
      "'strict-dynamic'",
      'https://cdn.jsdelivr.net',
      'https://esm.sh',
      'https://unpkg.com',
      'https://www.googletagmanager.com',
      'https://static.cloudflareinsights.com',
    ].join(' '),
    [
      'style-src',
      "'self'",
      nonceSource,
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
    ].join(' '),
    "font-src 'self' https://fonts.gstatic.com data:",
    [
      'img-src',
      "'self'",
      'data:',
      'blob:',
      'https://img.abdulkerimsesli.de',
      'https://i.ytimg.com',
      'https://img.youtube.com',
      'https://www.google-analytics.com',
    ].join(' '),
    [
      'connect-src',
      "'self'",
      'https://www.googleapis.com',
      'https://api.github.com',
      'https://raw.githubusercontent.com',
      'https://www.google-analytics.com',
      'https://region1.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://static.cloudflareinsights.com',
    ].join(' '),
    [
      'frame-src',
      "'self'",
      'https://www.youtube-nocookie.com',
      'https://www.youtube.com',
      'https://www.googletagmanager.com',
    ].join(' '),
    "media-src 'self' https://www.youtube.com https://*.googlevideo.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}
