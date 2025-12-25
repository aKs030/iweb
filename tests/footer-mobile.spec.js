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
    // Simulate a scroll event to trigger GlobalClose handlers (mobile)
    const dbg = await page.evaluate(() => ({
      hasGestureHandler: !!window._footerGestureCloseHandler,
      programmaticActive: typeof ProgrammaticScroll !== 'undefined' ? ProgrammaticScroll.hasActive() : null
    }))
    console.log('DBG before scroll:', dbg)

    // Dispatch a wheel event (our gesture fallback listens for 'wheel' and 'touchmove')
    await page.evaluate(() => window.dispatchEvent(new Event('wheel', {bubbles: true})))
    // wait a short while for debounce/close to run
    await page.waitForTimeout(1000)

    const dbgAfter = await page.evaluate(() => ({
      hasGestureHandler: !!window._footerGestureCloseHandler,
      programmaticActive: typeof ProgrammaticScroll !== 'undefined' ? ProgrammaticScroll.hasActive() : null
    }))
    console.log('DBG after scroll:', dbgAfter)

    await expect(footer).not.toHaveClass(/footer-expanded/)
  })
})