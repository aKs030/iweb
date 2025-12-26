// Quick ESM test for canonical path normalization & route-mapping
// Usage: node scripts/test-canonical.mjs

import { getCanonicalPathFromRoutes } from '../content/utils/canonical-utils.js'

const ROUTES = {
  '/projekte/': true,
  '/blog/': true,
  '/about/': true,
  '/videos/': true,
  '/gallery/': true
}

const tests = [
  ['/pages/projekte/index.html', '/projekte/'],
  ['/about.html', '/about/'],
  ['//pages//Blog/Index.HTML', '/blog/'],
  ['/', '/'],
  ['/contact', '/contact/'],
  ['/contact/', '/contact/'],
  ['/index.html', '/'],
  ['/pages/', '/pages/'],
  ['/pages', '/pages/'],
  ['/videos/special.html', '/videos/'],
  ['/gallery/photo1.html', '/gallery/']
]

console.log('Testing canonical normalization (path only):')

const expect = (got, want, msg) => {
  if (got !== want) {
    console.error(`❌ ${msg}: got '${got}' want '${want}'`)
    process.exitCode = 2
  } else console.log(`✅ ${msg}`)
}

tests.forEach(([inp, want], i) => {
  const got = getCanonicalPathFromRoutes(inp, ROUTES)
  console.log(`${inp} => ${got} (expect ${want})`)
  expect(got, want, `test #${i + 1}`)
})

if (!process.exitCode) console.log('\nAll quick checks passed')
