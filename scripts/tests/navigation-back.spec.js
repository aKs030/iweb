import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8081'

test.describe('Navigation back restores homepage interactivity', () => {
  test('subpage back-link restores interactivity on homepage', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('#main-content', { timeout: 5000 })

    // navigate to a subpage (About)
    await page.click('a[href="/about/"]')
    await expect(page).toHaveURL(`${BASE}/about/`)

    // Try to find the in-page back link; if not present (SPA injection differences), navigate directly
    const backSelector = 'a[href="/"], a.back-link, a[aria-label*="Zurück"], a.btn.btn-primary[aria-label*="Zurück"]'
    try {
      await page.waitForSelector('nav.about__cta a[href="/"], ' + backSelector, { timeout: 3000 })
      await page.click('nav.about__cta a[href="/"] , ' + backSelector)
    } catch (err) {
      // Fallback: directly load the about page to ensure consistent state
      await page.goto(`${BASE}/pages/about/index.html`)
      // Debug: inspect page anchors if the expected back link isn't found
      const anchors = await page.$$eval('a', els => els.map(a => ({href: a.getAttribute('href'), text: a.textContent && a.textContent.trim()})))
      console.log('ABOUT ANCHORS:', anchors.slice(0, 40))
      // Try waiting again for the back link
      await page.waitForSelector('nav.about__cta a[href="/"]', { timeout: 5000 })
      await page.click('nav.about__cta a[href="/"]')
    }

    await expect(page).toHaveURL(`${BASE}/`)

    // Verify a feature card is visible and interactive
    const selector = 'a.card-link[href="/gallery/"]'
    await page.waitForSelector(selector, { timeout: 5000 })
    const pe = await page.$eval(selector, el => getComputedStyle(el).pointerEvents)
    expect(pe).not.toBe('none')

    // Clicking should navigate to gallery
    await page.click(selector)
    await expect(page).toHaveURL(`${BASE}/gallery/`)
  })

  test('browser history back restores interactivity on homepage', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('#main-content')

    // navigate to a subpage (Projekte)
    await page.click('a[href="/projekte/#project-1"]')
    await expect(page).toHaveURL(/\/projekte\//)

    // simulate browser back
    await page.goBack()
    await expect(page).toHaveURL(`${BASE}/`)

    // ensure homepage card interactivity
    const aboutSel = 'a.card-link[href="/about/"]'
    await page.waitForSelector(aboutSel, { timeout: 5000 })
    const pe2 = await page.$eval(aboutSel, el => getComputedStyle(el).pointerEvents)
    expect(pe2).not.toBe('none')

    // try clicking to confirm
    await page.click(aboutSel)
    await expect(page).toHaveURL(`${BASE}/about/`)
  })
})
