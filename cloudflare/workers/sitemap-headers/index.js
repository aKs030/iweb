addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)

  // Passthrough fetch
  const response = await fetch(request)

  // Only modify sitemap responses
  if (url.pathname === '/sitemap.xml' || url.pathname === '/sitemap-videos.xml') {
    const headers = new Headers(response.headers)
    headers.set('X-Robots-Tag', 'noindex, noarchive')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }

  return response
}
