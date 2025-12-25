const {test, expect} = require('@playwright/test')

test.describe('Section loader', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
  })

  test('section3 loads its content', async ({page}) => {
    const section = page.locator('#section3')

    // Force load the section if it hasn't been triggered by intersection
    await page.evaluate(() => {
      const s = document.getElementById('section3')
      if (window.SectionLoader && s && (!s.dataset.state || s.dataset.state === '')) {
        return window.SectionLoader.loadSection(s)
      }
      return null
    })

    // Wait for loaded state or for the heading to appear
    const heading = page.locator('#section3 #about-heading')
    await expect(heading).toBeVisible({timeout: 7000})
    await expect(heading).toHaveText(/Danke für Ihren Besuch!/)
  })
})