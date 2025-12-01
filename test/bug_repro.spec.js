const { test, expect } = require('@playwright/test');

test('SectionTracker should NOT track removed sections with stale entries', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForLoadState('networkidle');

  // Inject a Ghost section and HIDE others to ensure Ghost is the only candidate
  await page.evaluate(() => {
    // Hide existing sections
    document.querySelectorAll('section').forEach(s => {
      s.style.display = 'none';
      s.classList.remove('section'); // Remove class so refreshSections ignores them
    });

    const main = document.querySelector('main');
    const ghost = document.createElement('section');
    ghost.id = 'ghost-section';
    ghost.className = 'section';
    ghost.style.height = '100vh';
    ghost.style.background = 'red';
    ghost.innerHTML = '<h1>Ghost</h1>';
    ghost.style.display = 'block';
    main.prepend(ghost);

    // Trigger tracker refresh
    document.dispatchEvent(new CustomEvent('section:loaded'));
  });

  // Wait for observer
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Debug: check tracked sections
  const trackedCount = await page.evaluate(() => window.sectionTracker.sections.length);
  console.log('Tracked sections:', trackedCount);

  const ratios = await page.evaluate(() => {
    return Array.from(window.sectionTracker.sectionRatios.entries()).map(([k, v]) => ({
      id: k,
      ratio: v.ratio,
      isIntersecting: v.isIntersecting,
      targetId: v.target.id
    }));
  });
  console.log('Ratios:', ratios);

  // Verify Ghost is current
  let currentId = await page.evaluate(() => window.sectionTracker.currentSectionId);
  console.log('Current ID (Initial):', currentId);
  expect(currentId).toBe('ghost-section');

  // CHANGE ID of the Ghost section
  await page.evaluate(() => {
    const ghost = document.getElementById('ghost-section');
    ghost.id = 'ghost-section-renamed';
    // Trigger refresh so tracker updates its list of sections (this.sections)
    document.dispatchEvent(new CustomEvent('section:loaded'));
  });

  // Wait for observer update
  await page.evaluate(() => window.scrollBy(0, 1));
  await page.waitForTimeout(1000);

  // Verify current ID.
  currentId = await page.evaluate(() => window.sectionTracker.currentSectionId);
  console.log('Current ID (After Rename):', currentId);

  // Debug ratios again
  const ratiosAfter = await page.evaluate(() => {
    return Array.from(window.sectionTracker.sectionRatios.entries()).map(([k, v]) => ({
      id: k,
      ratio: v.ratio,
      isIntersecting: v.isIntersecting,
      targetId: v.target.id
    }));
  });
  console.log('Ratios After:', ratiosAfter);

  // The BUG is that 'ghost-section' remains in the Map and since it was inserted first, it might win.
  // We expect it to be 'ghost-section-renamed'.
  expect(currentId).toBe('ghost-section-renamed');
});
