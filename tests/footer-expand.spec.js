const {test, expect} = require('@playwright/test')

test.describe('Footer expand stability', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
  })

  test('footer stays expanded after first small scroll', async ({page}) => {
    const footer = page.locator('#site-footer')
    const trigger = page.locator('#footer-trigger-zone')

    // Wait for footer and trigger to be available
    await expect(footer).toBeVisible({timeout: 5000})
    await expect(trigger).toBeVisible({timeout: 5000})

    // Perform a very small scroll near bottom
    await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight - 6, behavior: 'auto'}))

    // Wait until footer becomes expanded
    await expect(footer).toHaveClass(/footer-expanded/, {timeout: 2000})

    // Ensure it remains expanded for at least 400ms (lock period + margin)
    await page.waitForTimeout(400)
    await expect(footer).toHaveClass(/footer-expanded/)
  })
})