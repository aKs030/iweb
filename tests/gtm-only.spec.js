const { test, expect } = require('@playwright/test')

test('When GTM is configured, no direct gtag.js for GA4 is loaded and IDs are in dataLayer', async ({ page }) => {
  const requests = []
  page.on('request', r => requests.push(r.url()))

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })

  // Ensure GTM script loads
  const gtmLoaded = requests.some(u => u.includes('googletagmanager.com/gtm.js'))
  expect(gtmLoaded).toBeTruthy()

  // Ensure there is NOT a direct gtag.js load for the GA4 measurement ID
  const ga4GtagLoaded = requests.some(u => u.includes('gtag/js?id=G-PRCQ2397M4'))
  expect(ga4GtagLoaded).toBeFalsy()

  // Ensure noscript iframe exists
  const ns = await page.locator('#gtm-noscript').count()
  expect(ns).toBeGreaterThan(0)

  // Check dataLayer contains the identifiers for GTM to consume
  const dl = await page.evaluate(() => window.dataLayer || [])
  const hasGtmFlag = dl.some(i => i && i.gtm_autoconfig === true)
  const hasGtmId = dl.some(i => i && i.gtm_id === 'GT-TQTFN4NN')
  const hasGa4 = dl.some(i => i && i.ga4_measurement_id === 'G-S0587RQ4CN')
  // default mapping now points to AW-17819941793 for the local/default host
  const hasAds = dl.some(i => i && i.ads_conversion_id === 'AW-17819941793')

  expect(hasGtmFlag).toBeTruthy()
  expect(hasGtmId).toBeTruthy()
  expect(hasGa4).toBeTruthy()
  expect(hasAds).toBeTruthy()
})