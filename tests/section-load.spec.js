const {test, expect} = require('@playwright/test')

// Verify that extensionless section requests (e.g. /pages/home/hero) do not cause noisy 404s
test('No noisy 404s for extensionless section includes', async ({page}) => {
  const failed = []
  page.on('requestfailed', request => {
    const url = request.url()
    if (url.includes('/pages/home/hero') || url.includes('/pages/about/section3')) {
      failed.push({url, status: request.failure()?.errorText || 'failed'})
    }
  })

  await page.goto('/')
  // Give SectionLoader time to run and attempt loads
  await page.waitForTimeout(500)

  expect(failed.length).toBe(0)
})
