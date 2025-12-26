const { test, expect } = require('@playwright/test')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:8081'

test('security headers are present and sane for HTML pages', async ({ page }) => {
  const res = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const headers = res.headers()

  expect(headers['strict-transport-security']).toBeTruthy()
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  // We require a CSP to be present in production
  expect(headers['content-security-policy']).toBeTruthy()

  // If Access-Control-Allow-Origin is set, it should not be a wildcard on HTML
  if (headers['access-control-allow-origin']) {
    expect(headers['access-control-allow-origin']).not.toBe('*')
  }
})

test('assets should have long cache TTL', async ({ page }) => {
  const assetPath = '/content/assets/img/icons/icon-512.png'
  const res = await page.goto(`${BASE}${assetPath}`)
  const headers = res.headers()

  expect(headers['cache-control']).toBeTruthy()
  const cc = headers['cache-control'] || ''
  const m = cc.match(/max-age=(\d+)/)
  expect(m).toBeTruthy()
  const maxAge = parseInt(m[1], 10)
  // Expect at least 1 day for static assets (adjust if you prefer longer)
  expect(maxAge).toBeGreaterThanOrEqual(86400)
})
