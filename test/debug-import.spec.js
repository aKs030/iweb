const { test } = require('@playwright/test');

test('debug import shared utilities', async ({ page }) => {
  page.on('console', (msg) => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.error('PAGE_ERROR:', err));
  page.on('requestfailed', (req) => console.log('REQUEST FAILED:', req.url(), req.failure().errorText));
  page.on('request', (req) => console.log('REQUEST:', req.method(), req.url()));
  page.on('response', (resp) => console.log('RESPONSE:', resp.status(), resp.url()));

  await page.goto('/');

  const result = await page.evaluate(async () => {
    try {
      const mod = await import('/content/shared-utilities.js');
      return { ok: true, keys: Object.keys(mod) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  console.log('EVAL RESULT:', result);
});
