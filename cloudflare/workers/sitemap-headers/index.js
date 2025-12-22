addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // Forward the request to origin (Cloudflare will fetch the existing sitemap)
  const res = await fetch(request)

  // If sitemap path, add X-Robots-Tag header to prevent SERP listing
  if (path === '/sitemap.xml' || path === '/sitemap-videos.xml') {
    const headers = new Headers(res.headers)
    headers.set('X-Robots-Tag', 'noindex, noarchive')
    // Keep content-type and other headers intact
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    })
  }

  return res
}