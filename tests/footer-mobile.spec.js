const {test, expect} = require('@playwright/test')

// Simple mobile behavior tests for footer expansion/collapse
test.describe('Footer mobile gestures', () => {
  test('footer expands on trigger and collapses on small scroll (mobile)', async ({page}) => {
    await page.setViewportSize({width: 375, height: 800})
    await page.goto('/')

    // Open footer via data-footer-trigger (if present) or by clicking the footer cookie button
    const trigger = page.locator('[data-footer-trigger]').first()
    if (await trigger.count() > 0) {
      // Ensure element is visible/clickable on mobile viewport
      try {
        await trigger.scrollIntoViewIfNeeded()
        await trigger.click({force: true})
      } catch (e) {
        // Fallback: trigger via DOM to avoid Playwright click stability issues
        await page.evaluate(() => document.querySelector('[data-footer-trigger]')?.click())
      }
    } else {
      await page.evaluate(() => document.querySelector('.footer-cookie-btn')?.click())
    }

    const footer = page.locator('#site-footer')
    await expect(footer).toHaveClass(/footer-expanded/, {timeout: 3000})

    // Small scroll down should trigger collapse on mobile
    await page.mouse.wheel(0, 30)
    // wait a short while for debounce/close to run
    await page.waitForTimeout(800)

    await expect(footer).not.toHaveClass(/footer-expanded/)
  })
})