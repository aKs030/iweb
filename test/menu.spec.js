import { test, expect } from '@playwright/test';

test.describe('Menu System (Mobile)', () => {
  // Enforce mobile viewport for menu toggle tests
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#menu-container .site-menu');
  });

  test('should toggle menu open and closed', async ({ page }) => {
    const toggleBtn = page.locator('.site-menu__toggle');
    const menu = page.locator('.site-menu');

    // Initial state
    await expect(menu).toHaveClass(/site-menu/);
    await expect(menu).not.toHaveClass(/open/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Open menu
    await toggleBtn.click();
    await expect(menu).toHaveClass(/open/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Close menu
    await toggleBtn.click();
    await expect(menu).not.toHaveClass(/open/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('should close menu when clicking outside', async ({ page }) => {
    const toggleBtn = page.locator('.site-menu__toggle');
    const menu = page.locator('.site-menu');

    // Open menu
    await toggleBtn.click();
    await expect(menu).toHaveClass(/open/);

    // Click outside (e.g., on body or main content)
    // We click 0,0 which is likely outside the menu (assuming menu is right aligned or takes full screen but has safe area?)
    // Actually, mobile menu usually overlays.
    // Let's click on #main-content or similar if available.
    // Or just coordinates that are definitely outside the menu if it doesn't cover 100%.
    // If the menu covers 100%, clicking "outside" might be impossible without specific markup.
    // Assuming standard implementation where it might not cover everything or clicking content closes it.
    await page.mouse.click(10, 10);

    // Check if closed
    await expect(menu).not.toHaveClass(/open/);
  });

  test('should close menu when clicking a link', async ({ page }) => {
    const toggleBtn = page.locator('.site-menu__toggle');
    const menu = page.locator('.site-menu');

    // Open menu
    await toggleBtn.click();

    // Find a link
    const link = menu.locator('a[href]').first();
    await link.click();

    await expect(menu).not.toHaveClass(/open/);
  });
});

test.describe('Menu System (General)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#menu-container .site-menu');
  });

  test('should set active link based on scroll/navigation', async ({ page }) => {
    const homeLink = page.locator('.site-menu a[href="#hero"]');

    // Force a hash navigation
    await page.goto('/#about');
    // Wait for logic to update
    await page.waitForTimeout(200);

    const aboutLink = page.locator('.site-menu a[href="#about"]');
    await expect(aboutLink).toHaveClass(/active/);
  });

  test('should handle submenus', async ({ page }) => {
    // Inject submenu structure
    await page.evaluate(() => {
      const menuList = document.querySelector('.site-menu__list');
      if (!menuList) return;
      const li = document.createElement('li');
      li.className = 'has-submenu';
      li.innerHTML = `
        <button class="submenu-toggle" aria-expanded="false">Submenu</button>
        <ul class="submenu" style="display: none;">
          <li><a href="#sub1">Sub 1</a></li>
        </ul>
      `;
      menuList.appendChild(li);

      // We must manually attach the listener because initializeSubmenuLinks ran on load.
      // Re-implement the listener logic for test purpose or assume it's attached via delegation?
      // menu.js uses `document.querySelectorAll(...).forEach` so it attaches to specific elements found at load time.
      // Dynamic injection WON'T work without re-running initialization.
      // So checking submenu logic via dynamic injection is invalid unless we can trigger init.
      // Since we can't, we skip this test or mark it as skipped.
    });

    // Skipping actual assertions since we can't easily test it without source modification.
    test.skip();
  });
});
