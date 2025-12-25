import { test, expect } from '@playwright/test';

test.describe('Lint Fix Regression Tests', () => {
  test('Projekte page loads and displays projects', async ({ page }) => {
    // Navigate to the projects page
    await page.goto('/pages/projekte/index.html');

    // Wait for the app to load
    await expect(page.locator('.headline')).toBeVisible();
    // Use more specific locator because "Meine Projekte." is split into spans
    await expect(page.locator('.headline')).toContainText('Meine');
    await expect(page.locator('.headline')).toContainText('Projekte.');

    // Verify project cards are present
    const projectCards = page.locator('.project-grid');
    await expect(projectCards).toHaveCount(4); // Based on the mock data in projekte-app.js

    // Verify "App öffnen" buttons exist
    const openAppButtons = page.locator('button:has-text("App öffnen")');
    await expect(openAppButtons.first()).toBeVisible();
  });
});
