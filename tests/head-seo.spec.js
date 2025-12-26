const { test, expect } = require('@playwright/test')

test.describe('Head / SEO checks', () => {
  test('canonical and og:url reflect page URL', async ({ page }) => {
    await page.goto('/videos/')
    const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href')
    const ogUrl = await page.locator('head meta[property="og:url"]').getAttribute('content')
    const pageUrl = page.url().split('#')[0]
    // Accept both relative canonical (/videos/) or absolute (http://localhost:8081/videos/)
    expect(canonical === '/videos/' || canonical.endsWith('/videos/')).toBeTruthy()
    expect(ogUrl).toBe(pageUrl)
  })

  test('JSON-LD is present and includes WebPage', async ({ page }) => {
    await page.goto('/videos/')
    const ld = await page.locator('script[type="application/ld+json"]').nth(0).textContent()
    const payload = JSON.parse(ld)
    if (payload['@graph']) {
      const hasWebPage = payload['@graph'].some(g => g['@type'] === 'WebPage')
      expect(hasWebPage).toBeTruthy()
    } else {
      expect(payload['@type'] === 'WebPage' || payload['@type'] === 'BreadcrumbList').toBeTruthy()
    }
  })
})
