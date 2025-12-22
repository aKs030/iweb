addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  // Paths we want to add the X-Robots-Tag header to
  const sitemapPaths = ['/sitemap.xml', '/sitemap-videos.xml']

  // fetch origin response
  const originResponse = await fetch(request)

  // If the request path matches our sitemap paths, clone and add header
  if (sitemapPaths.includes(url.pathname)) {
    const headers = new Headers(originResponse.headers)
    headers.set('X-Robots-Tag', 'noindex, noarchive')
    // keep content-type as-is and other headers
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers
    })
  }

  // otherwise pass through
  return originResponse
}