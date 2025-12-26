// validate-ldjson.mjs
// Fetch a page and validate that it includes application/ld+json with @graph and WebPage entry
const url = process.argv[2] || 'http://127.0.0.1:8081/'

async function run() {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  const m = text.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (!m) throw new Error('No LD+JSON script tag found')
  let payload
  try {
    payload = JSON.parse(m[1])
  } catch (e) {
    throw new Error('LD+JSON content is not valid JSON')
  }

  if (!payload['@graph'] && !(payload['@type'] === 'WebPage' || payload['@type'] === 'BreadcrumbList')) {
    throw new Error('LD+JSON does not contain expected @graph or WebPage')
  }

  console.log('LD+JSON found and seems valid')
}

run().catch(err => {
  console.error(err)
  process.exit(2)
})