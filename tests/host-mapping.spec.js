const { test, expect } = require('@playwright/test')

test('host mapping returns correct GTM/GA4 ids for known hosts', async ({ page }) => {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })

  const mapForAbdul = await page.evaluate(() => {
    if (window.__getGtmConfigForHost) return window.__getGtmConfigForHost('abdulkerimsesli.de')
    return null
  })

  expect(mapForAbdul).toBeTruthy()
  expect(mapForAbdul.gtm).toBe('GTM-5F5ZSTTL')
  expect(mapForAbdul.ga4).toBe('G-757KWG0PG4')

  const mapDefault = await page.evaluate(() => window.__getGtmConfigForHost('example.com'))
  expect(mapDefault).toBeTruthy()
  expect(mapDefault.gtm).toBe('GT-TQTFN4NN')
  expect(mapDefault.ga4).toBe('G-S0587RQ4CN')
  // default should carry the correct AW conversion id
  expect(mapDefault.aw).toBe('AW-17819941793')
})