import { test, expect } from '@playwright/test';

test.describe('TypeWriter', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page to provide a window context
    // Using a query param to avoid affecting other tests or caching issues
    await page.goto('/?test=typewriter');
  });

  test('should type text correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TypeWriter } = await import('/content/TypeWriter/TypeWriter.js');

      const textEl = document.createElement('span');
      const authorEl = document.createElement('span');
      const quotes = [{ text: 'Hello', author: 'World' }];

      const _tw = new TypeWriter({
        textEl,
        authorEl,
        quotes,
        wait: 1000, // Long wait before deleting
        typeSpeed: 10,
        deleteSpeed: 10,
        shuffle: false,
        loop: false
      });

      // Wait for typing to finish
      // Poll until text matches or timeout
      const start = performance.now();
      while (textEl.textContent !== 'Hello' && performance.now() - start < 2000) {
        await new Promise(r => setTimeout(r, 50));
      }

      return {
        text: textEl.textContent,
        author: authorEl.textContent
      };
    });

    expect(result.text).toBe('Hello');
    expect(result.author).toBe('World');
  });

  test('should delete text and loop/stop', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TypeWriter } = await import('/content/TypeWriter/TypeWriter.js');

      const textEl = document.createElement('span');
      const authorEl = document.createElement('span');
      const quotes = [{ text: 'A', author: 'B' }];

      const _tw = new TypeWriter({
        textEl,
        authorEl,
        quotes,
        wait: 50,      // wait before deleting
        typeSpeed: 10,
        deleteSpeed: 10,
        shuffle: false,
        loop: false
      });

      // Wait for cycle to complete (Type -> Wait -> Delete)
      // Poll for empty string after it was typed

      // 1. Wait for typing
      const start = performance.now();
      while (textEl.textContent !== 'A' && performance.now() - start < 1000) {
        await new Promise(r => setTimeout(r, 50));
      }

      if (textEl.textContent !== 'A') return { text: 'TIMEOUT_TYPING' };

      // 2. Wait for deletion
      const startDel = performance.now();
      while (textEl.textContent !== '' && performance.now() - startDel < 1000) {
        await new Promise(r => setTimeout(r, 50));
      }

      return {
        text: textEl.textContent
      };
    });

    expect(result.text).toBe('');
  });

  test('should dispatch hero:typingEnd event', async ({ page }) => {
    const eventFired = await page.evaluate(async () => {
      const { TypeWriter } = await import('/content/TypeWriter/TypeWriter.js');

      const textEl = document.createElement('span');
      const authorEl = document.createElement('span');
      const quotes = [{ text: 'Hi', author: 'Me' }];

      let fired = false;
      document.addEventListener('hero:typingEnd', (e) => {
        if (e.detail.text === 'Hi') fired = true;
      });

      const _tw = new TypeWriter({
        textEl,
        authorEl,
        quotes,
        wait: 1000,
        typeSpeed: 10,
        deleteSpeed: 10,
        loop: false
      });

      // Poll for event
      const start = performance.now();
      while (!fired && performance.now() - start < 1000) {
        await new Promise(r => setTimeout(r, 50));
      }

      return fired;
    });

    expect(eventFired).toBe(true);
  });
});
