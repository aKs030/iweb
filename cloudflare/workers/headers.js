addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

const ASSET_TTL = 31536000 // 1 year

async function handle(request) {
  const url = new URL(request.url)
  const res = await fetch(request)
  const newHeaders = new Headers(res.headers)

  // Security headers
  newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  newHeaders.set('X-Content-Type-Options', 'nosniff')
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  newHeaders.set('X-Frame-Options', 'DENY')
  newHeaders.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  // A conservative, simple CSP — adapt for your real site
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com; frame-ancestors 'self'; base-uri 'self';"
  newHeaders.set('Content-Security-Policy', csp)

  // Remove wildcard CORS on HTML pages
  if (newHeaders.get('content-type') && newHeaders.get('content-type').includes('text/html')) {
    if (newHeaders.get('access-control-allow-origin') === '*') {
      newHeaders.delete('access-control-allow-origin')
    }
    // Keep HTML non-cacheable by default
    newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate')
  }

  // For static assets (images, css, js), set a long cache TTL and allow broad CORS if desired
  if (url.pathname.startsWith('/content/assets/') || /\.(png|jpg|jpeg|gif|svg|css|js|woff2?)$/.test(url.pathname)) {
    newHeaders.set('Cache-Control', `public, max-age=${ASSET_TTL}, immutable`)
    // Optional: allow cross-origin for static assets
    // newHeaders.set('Access-Control-Allow-Origin', '*')
  }

  // Return modified response
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders
  })
}
