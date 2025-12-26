const { test, expect } = require('@playwright/test')

test('GTM and GA4 load and noscript inserted', async ({ page }) => {
  const requests = []
  page.on('request', r => {
    const url = r.url()
    if (url.includes('googletagmanager.com/gtm.js') || url.includes('googletagmanager.com/ns.html')) requests.push(url)
    if (url.includes('googletagmanager.com/gtag/js') || url.includes('google-analytics.com/g/collect') || url.includes('google-analytics.com/mp/collect')) requests.push(url)
  })

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })

  // Wait for noscript iframe to be inserted (it is added on DOMContentLoaded)
  const ns = await page.locator('#gtm-noscript').count()
  expect(ns).toBeGreaterThan(0)

  // Ensure we saw either GTM or GA4 requests
  expect(requests.length).toBeGreaterThan(0)
})
