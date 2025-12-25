const {test, expect} = require('@playwright/test')

test.describe('Footer / Scroll-trigger', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
    // Wait for footer to be loaded by FooterLoader
    await page.waitForSelector('#site-footer', {timeout: 2000})
    // Ensure the trigger exists and the scroll handler is initialized
    await page.waitForSelector('#footer-trigger-zone', {state: 'attached', timeout: 2000})
    await page.evaluate(() => {
      // Give the ScrollHandler a moment to initialize
      return new Promise(resolve => setTimeout(resolve, 120))
    })
    // Ensure we start near but not at the bottom
    await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight - 200, behavior: 'auto'}))
  })

  test('tiny scroll expands footer and keeps it expanded', async ({page}) => {
    // Attach a small observer to report class after a minimal scroll
    await page.evaluate(() => {
      window._footer_state = false
      const f = document.getElementById('site-footer')
      if (f) {
        const obs = new MutationObserver(() => {
          window._footer_state = f.classList.contains('footer-expanded')
        })
        obs.observe(f, {attributes: true, attributeFilter: ['class']})
      }
    })

    // Ensure enough page height so scrolling actually moves the trigger into view
    await page.evaluate(() => {
      const footer = document.getElementById('footer-container') || document.querySelector('footer')
      if (footer && !document.getElementById('test-spacer')) {
        const spacer = document.createElement('div')
        spacer.id = 'test-spacer'
        spacer.style.height = '2000px'
        spacer.style.width = '1px'
        spacer.style.background = 'transparent'
        footer.parentNode.insertBefore(spacer, footer)
      }

      // Instrument the trigger with a lightweight observer to collect events for diagnostics
      window._io_logs = []
      const t = document.getElementById('footer-trigger-zone')
      if (t) {
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => window._io_logs.push({isIntersecting: !!e.isIntersecting, ratio: e.intersectionRatio}))
        }, {rootMargin: '0px 0px -1% 0px', threshold: [0, 0.002, 0.005, 0.01, 0.02, 0.05]})
        io.observe(t)
        window._io_logger = io
      }
    })

    // Capture trigger rect before scrolling and then scroll to bring it into the viewport
    const rectBefore = await page.evaluate(() => {
      const t = document.getElementById('footer-trigger-zone')
      return t ? t.getBoundingClientRect() : null
    })

    await page.evaluate(() => {
      const t = document.getElementById('footer-trigger-zone')
      if (!t) return
      const rect = t.getBoundingClientRect()
      // We want the trigger to be just inside the viewport by 2px
      const desiredViewportY = window.innerHeight - 2
      const scrollByY = rect.top - desiredViewportY
      window.scrollBy({top: scrollByY, behavior: 'auto'})
    })

    await page.waitForTimeout(250)

    const rectAfter = await page.evaluate(() => {
      const t = document.getElementById('footer-trigger-zone')
      return t ? t.getBoundingClientRect() : null
    })

    // Give observer code a short moment to react
    await page.waitForTimeout(400)

    const ioLogs = await page.evaluate(() => window._io_logs.slice())
    console.log('rect before', rectBefore, 'rect after', rectAfter, 'IO logs:', ioLogs)
    const expanded = await page.evaluate(() => window._footer_state)

    // For debugging: include logs in assertion message
    expect(expanded, `Footer did not expand; IO logs: ${JSON.stringify(ioLogs)}`).toBeTruthy()

    // Simulate a tiny bounce (small scroll up) that might cause transient false entries
    await page.evaluate(() => window.scrollBy({top: -2, behavior: 'auto'}))
    await page.waitForTimeout(250)

    const stillExpanded = await page.evaluate(() => window._footer_state)
    expect(stillExpanded).toBeTruthy()
  })
})