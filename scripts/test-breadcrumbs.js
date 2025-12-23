const fs = require('fs')
const path = require('path')

const siteBase = 'https://abdulkerimsesli.de'
const sections = {
  '/projekte/': 'Projekte',
  '/blog/': 'Blog',
  '/videos/': 'Videos',
  '/gallery/': 'Galerie',
  '/about/': 'Über'
}

function makeTrail(currentPath, safePageTitle) {
  const pathNormalized = currentPath.endsWith('/') ? currentPath : currentPath + '/'
  const pathKey = pathNormalized
  const trail = [{name: 'Startseite', url: siteBase + '/'}]

  const sectionKey =
    Object.keys(sections).find(k => pathKey === k || pathKey.startsWith(k)) || Object.keys(sections).find(k => pathKey.includes(k))

  if (pathKey !== '/') {
    const sectionUrl = sectionKey ? siteBase + sectionKey : null
    const pageUrl = siteBase + pathKey

    if (sectionKey) {
      trail.push({name: sections[sectionKey], url: sectionUrl})
    }

    const lastUrls = trail.map(t => t.url)
    if (!lastUrls.includes(pageUrl) && !trail.some(t => t.name === safePageTitle)) {
      trail.push({name: safePageTitle, url: pageUrl})
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': trail.map((t, i) => ({'@type': 'ListItem', 'position': i + 1, 'name': t.name, 'item': t.url}))
  }
}

// Test cases
const tests = [
  {path: '/', title: 'Abdulkerim — Digital Creator Portfolio'},
  {path: '/videos/', title: 'Video-Tutorials & Demos | Abdulkerim Sesli'},
  {path: '/projekte/', title: 'Webentwicklung & Coding Projekte | Abdulkerim Sesli'}
]

for (const t of tests) {
  console.log('===', t.path, '===')
  console.log(JSON.stringify(makeTrail(t.path, t.title), null, 2))
}

// Scan actual HTML files for BreadcrumbList JSON-LD and report duplicates
const scanFiles = ['pages/videos/index.html', 'pages/projekte/index.html', 'index.html']

function extractJsonLd(content) {
  const scripts = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = regex.exec(content))) {
    scripts.push(m[1].trim())
  }
  return scripts
}

for (const f of scanFiles) {
  try {
    const c = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
    const scripts = extractJsonLd(c)
    for (const s of scripts) {
      try {
        const j = JSON.parse(s)
        if (j['@type'] === 'BreadcrumbList' || (Array.isArray(j) && j.some(x => x && x['@type'] === 'BreadcrumbList'))) {
          const list = Array.isArray(j) ? j.find(x => x['@type'] === 'BreadcrumbList') : j
          const items = list.itemListElement || []
          const urls = items.map(it => it.item)
          const dup = urls.filter((u, i) => urls.indexOf(u) !== i)
          console.log('\nFile:', f)
          console.log('Breadcrumb items:', urls)
          if (dup.length) console.log('Duplicate URLs found:', [...new Set(dup)])
          else console.log('No duplicate URLs')
        }
      } catch (e) {
        // ignore parse
      }
    }
  } catch (e) {
    // file not found
  }
}
