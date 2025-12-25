const {test, expect} = require('@playwright/test')

test.describe('Section loader', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
  })

  test('section3 loads its content', async ({page}) => {
    const section = page.locator('#section3')
    // wait until SectionLoader marks it as loaded or until content is visible
    await expect(section).toHaveAttribute('data-state', /loaded|loading|error/, {timeout: 5000})

    // Wait for the about heading which exists in section3.html
    const heading = page.locator('#section3 #about-heading')
    await expect(heading).toBeVisible({timeout: 7000})
    await expect(heading).toHaveText(/Danke für Ihren Besuch!/)
  })
})