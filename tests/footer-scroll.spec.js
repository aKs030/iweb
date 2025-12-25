const {test, expect} = require('@playwright/test')

test.describe('Footer scroll behavior', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
  })

  test('footer expands on small scroll and stays expanded (desktop)', async ({page}) => {
    // small scroll near page bottom
    await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight - 6, behavior: 'auto'}))
    // give observer a little time
    await page.waitForTimeout(250)

    const footer = page.locator('#site-footer')
    await expect(footer).toHaveClass(/footer-expanded/, {timeout: 2000})

    // small reverse scroll should not collapse immediately
    await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight - 2, behavior: 'auto'}))
    await page.waitForTimeout(400)
    await expect(footer).toHaveClass(/footer-expanded/)
  })

  test('footer expands on small scroll and stays expanded (mobile)', async ({page}) => {
    await page.setViewportSize({width: 375, height: 812})
    await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight - 6, behavior: 'auto'}))
    await page.waitForTimeout(250)

    const footer = page.locator('#site-footer')
    await expect(footer).toHaveClass(/footer-expanded/, {timeout: 2000})

    await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight - 2, behavior: 'auto'}))
    await page.waitForTimeout(400)
    await expect(footer).toHaveClass(/footer-expanded/)
  })
})