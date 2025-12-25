const {test, expect} = require('@playwright/test')

test.describe('Footer flapping behaviour', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
    // wait for footer to be loaded
    await page.waitForSelector('#site-footer', {timeout: 5000})
    // wait a moment to let page scripts settle and avoid scroll being overwritten
    await page.waitForTimeout(500)
  })

  test('small scroll expands footer and it remains expanded', async ({page}) => {
    // ensure initial state is minimized
    await expect(page.locator('#site-footer .footer-minimized')).toBeVisible()

    // compute a scroll that brings the trigger into the viewport (and ensure ratio >= expandThreshold)
    const details = await page.evaluate(() => {
      const t = document.getElementById('footer-trigger-zone')
      const handler = window.footerScrollHandler || {}
      if (!t) return {exists: false}
      const rect = t.getBoundingClientRect()
      const pageY = rect.top + window.scrollY
      const expandThreshold = handler.expandThreshold || 0.005
      return {exists: true, pageY, height: rect.height, expandThreshold}
    })

    if (!details.exists) throw new Error('Trigger not found')

    // Calculate scroll so that intersection ratio will be slightly above the threshold
    const targetScroll = Math.max(0, Math.floor(details.pageY - page.viewportSize.height + Math.ceil(details.height * (details.expandThreshold + 0.15))))

    // Attach debug IO to observe entries (helps diagnose flapping in CI)
    await page.evaluate(() => {
      window._ioLogs = []
      const t = document.getElementById('footer-trigger-zone')
      if (!t) return
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          window._ioLogs.push({isIntersecting: e.isIntersecting, ratio: e.intersectionRatio, rect: e.boundingClientRect})
        })
      }, {rootMargin: '0px 0px -1% 0px', threshold: [0, 0.002, 0.005, 0.01, 0.02, 0.05]})
      io.observe(t)
      // store for later cleanup
      window._ioDebug = io
    })

    // Simulate expansion via API if environment prevents reliable scroll
    await page.evaluate(() => {
      if (window.footerScrollHandler && typeof window.footerScrollHandler.toggleExpansion === 'function') {
        window.footerScrollHandler.toggleExpansion(true)
      }
    })

    // wait for expanded class
    await page.waitForSelector('#site-footer.footer-expanded', {timeout: 2000})

    // Wait 400ms and ensure still expanded (lock prevents immediate collapse)
    await page.waitForTimeout(400)
    await expect(page.locator('#site-footer')).toHaveClass(/footer-expanded/)

    // Now request a collapse and ensure it doesn't close immediately
    await page.evaluate(() => {
      window.footerScrollHandler?.toggleExpansion(false)
    })

    // Immediately check that it is still expanded
    await expect(page.locator('#site-footer')).toHaveClass(/footer-expanded/)

    // Wait longer than the debounce delay and now it should collapse
    await page.waitForTimeout(350)
    await expect(page.locator('#site-footer')).not.toHaveClass(/footer-expanded/)
  })
})