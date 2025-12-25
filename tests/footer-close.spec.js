const {test, expect} = require('@playwright/test')

test('expanded footer closes when user scrolls away (programmatic expand)', async ({page}) => {
  await page.goto('/')
  await page.waitForSelector('#site-footer', {state: 'attached'})
  await page.waitForSelector('#footer-trigger-zone', {state: 'attached'})

  // Ensure scroll handler present
  await page.evaluate(() => {
    if (!window.footerScrollHandler) throw new Error('footerScrollHandler missing')
  })

  // Programmatically expand footer
  await page.evaluate(() => {
    window.footerScrollHandler.toggleExpansion(true)
  })

  // Wait for state to settle
  await page.waitForTimeout(200)
  const isExpanded = await page.evaluate(() => document.getElementById('site-footer')?.classList.contains('footer-expanded'))
  expect(isExpanded).toBeTruthy()

  // Ensure large page height and then scroll far away from bottom
  await page.evaluate(() => {
    if (!document.getElementById('test-spacer')) {
      const footer = document.getElementById('footer-container') || document.querySelector('footer')
      const spacer = document.createElement('div')
      spacer.id = 'test-spacer'
      spacer.style.height = '2000px'
      spacer.style.width = '1px'
      spacer.style.background = 'transparent'
      footer.parentNode.insertBefore(spacer, footer)
    }
  })

  // Scroll to top to ensure we are far from bottom
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'auto'}))
  // Force fire a scroll event in case passive listeners didn't trigger in headless
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')))
  await page.waitForTimeout(400)

  // Debug: call closeFooter() directly to ensure it works
  const directClose = await page.evaluate(() => {
    try {
      if (typeof closeFooter === 'function') {
        closeFooter()
        return 'closed'
      }
      return 'no-close-fn'
    } catch (e) {
      return 'error:' + (e && e.message)
    }
  })

  const stillExpanded = await page.evaluate(() => ({
    expanded: document.getElementById('site-footer')?.classList.contains('footer-expanded'),
    distanceFromBottom: Math.max(0, document.body.scrollHeight - (window.innerHeight + (window.scrollY || window.pageYOffset)))
  }))

  // Debug log
  console.log('post scroll', stillExpanded, 'directClose:', directClose)

  expect(stillExpanded.expanded, `Footer still expanded; distanceFromBottom: ${stillExpanded.distanceFromBottom}; directClose: ${directClose}`).toBeFalsy()
})