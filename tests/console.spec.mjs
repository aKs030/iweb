import { test, expect } from '@playwright/test';

// Simple test to capture console messages when loading /projekte/
test('capture console messages on /projekte/', async ({ page }) => {
  const messages = [];
  page.on('console', (msg) => {
    messages.push({ type: msg.type(), text: msg.text() });
  });

  await page.goto('http://127.0.0.1:8081/projekte/', { waitUntil: 'load' });

  // Wait a short time for lazy modules to log
  await page.waitForTimeout(1500);

  // Print captured messages to stdout (so we can read them)
  for (const m of messages) {
    console.log(`[console:${m.type}] ${m.text}`);
  }

  // Basic assertion: page should load
  await expect(page).toHaveTitle(/Projekte/);
});