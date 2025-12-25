const {test, expect} = require('@playwright/test')

test.describe('Footer / Cookie interactions', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
  })

  test('cookie consent banner appears and accept hides it', async ({page}) => {
    const banner = page.locator('#cookie-consent-banner')
    await expect(banner).toBeVisible()

    await page.click('#accept-cookies-btn')
    await expect(banner).toBeHidden()

    // cookie should be set
    const cookies = await page.context().cookies()
    const consent = cookies.find(c => c.name === 'cookie_consent')
    expect(consent).toBeTruthy()
    expect(consent.value).toBe('accepted')
  })

  test('open cookie settings and save with analytics disabled', async ({page}) => {
    // open footer cookie settings via trigger
    await page.click('[data-cookie-trigger]')
    const dialog = page.locator('#footer-cookie-view')
    await expect(dialog).toBeVisible()

    const analyticsToggle = page.locator('#footer-analytics-toggle')
    const checked = await analyticsToggle.isChecked()
    if (checked) {
      await analyticsToggle.click()
    }

    await page.click('#footer-accept-selected')
    await expect(dialog).toBeHidden()

    const cookies = await page.context().cookies()
    const consent = cookies.find(c => c.name === 'cookie_consent')
    expect(consent).toBeTruthy()
    expect(consent.value).toBe('rejected')
  })
})
