import { test, expect } from '@playwright/test';

// This test runs in a real browser context and verifies that client-side
// code can call the same-origin proxy /api/gemini and receive a valid text result.

test('client can call /api/gemini via navigator/fetch', async ({ page }) => {
  // Load the root page so CSP/meta tags apply
  await page.goto('/');

  const res = await page.evaluate(async () => {
    const r = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Integration test', systemInstruction: 'Antworte kurz: TEST' }),
    });
    const text = await r.text();
    return { status: r.status, body: text };
  });

  expect(res.status).toBe(200);
  const payload = JSON.parse(res.body);
  expect(payload).toHaveProperty('text');
  expect(typeof payload.text).toBe('string');
  expect(payload.text.length).toBeGreaterThan(0);
});