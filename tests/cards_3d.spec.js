const {test, expect} = require('@playwright/test')

test('3D Cards should be active and HTML cards hidden in Features section', async ({page}) => {
  // 1. Force ThreeEarth to run in test env
  await page.addInitScript(() => {
    window.__FORCE_THREE_EARTH = true
  })

  // 2. Go to page
  await page.goto('http://localhost:8081/index.html')

  // 3. Scroll to features
  // We use evaluate to ensure exact scrolling
  await page.evaluate(() => {
    document.getElementById('features').scrollIntoView()
  })

  // 4. Wait for Three.js system to init (canvas appearing)
  const canvas = page.locator('#threeEarthContainer canvas')
  await expect(canvas).toBeAttached({timeout: 15000})

  // 5. Check if body has the active class (which triggers CSS hiding)
  // The class is 'three-earth-active'
  await expect(page.locator('body')).toHaveClass(/three-earth-active/)

  // 6. Verify HTML cards are hidden (opacity 0) via CSS
  // We check the computed style
  const htmlCards = page.locator('#features .features-cards')
  await expect(htmlCards).toHaveCSS('opacity', '0')
  await expect(htmlCards).toHaveCSS('pointer-events', 'none')

  console.log('3D Cards verification passed')
})
