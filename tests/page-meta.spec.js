const { test, expect } = require('@playwright/test')

test('pageMetadataReady event and page_meta structure present in dataLayer', async ({ page }) => {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })

  // Wait for the event to be pushed (it should be on DOMContentLoaded)
  const dl = await page.evaluate(() => window.dataLayer || [])

  // find event object
  const evt = dl.find(i => i && i.event === 'pageMetadataReady')
  expect(evt).toBeTruthy()
  expect(evt.page_meta).toBeTruthy()

  const pm = evt.page_meta
  expect(pm.page_title).toBeTruthy()
  expect(pm.page_path).toBeTruthy()
  expect(pm.page_url).toContain('http')
  expect(pm.page_type).toBeTruthy()
  // page_image may be empty for some routes but should exist as a string
  expect(typeof pm.page_image).toBe('string')
})