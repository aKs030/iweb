import { test, expect } from '@playwright/test';

test.describe('Shared Utilities', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page to provide a window context
    // Using a query param to avoid affecting other tests or caching issues
    await page.goto('/?test=shared_utils');
  });

  test('should shuffle array correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { shuffle } = await import('/content/webentwicklung/shared-utilities.js');
      const input = [1, 2, 3, 4, 5];
      const shuffled = shuffle([...input]);
      return {
        isSameLength: input.length === shuffled.length,
        hasSameElements: input.every(i => shuffled.includes(i)),
        input,
        shuffled
      };
    });
    expect(result.isSameLength).toBe(true);
    expect(result.hasSameElements).toBe(true);
  });

  test('should generate randomInt within range', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { randomInt } = await import('/content/webentwicklung/shared-utilities.js');
      const min = 5;
      const max = 10;
      const results = [];
      for(let i=0; i<50; i++) {
        results.push(randomInt(min, max));
      }
      return {
        allInRange: results.every(r => r >= min && r <= max),
        minObserved: Math.min(...results),
        maxObserved: Math.max(...results)
      };
    });
    expect(result.allInRange).toBe(true);
    expect(result.minObserved).toBeGreaterThanOrEqual(5);
    expect(result.maxObserved).toBeLessThanOrEqual(10);
  });

  test('TimerManager should handle timeouts', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TimerManager } = await import('/content/webentwicklung/shared-utilities.js');
      const manager = new TimerManager();
      let fired = false;

      await new Promise(resolve => {
        manager.setTimeout(() => {
          fired = true;
          resolve();
        }, 50);
      });

      return fired;
    });
    expect(result).toBe(true);
  });

  test('TimerManager should clear timeouts', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TimerManager } = await import('/content/webentwicklung/shared-utilities.js');
      const manager = new TimerManager();
      let fired = false;

      const id = manager.setTimeout(() => {
        fired = true;
      }, 50);

      manager.clearTimeout(id);

      // Wait longer than the timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      return fired;
    });
    expect(result).toBe(false);
  });

  test('TimerManager should clear all timers', async ({ page }) => {
     const result = await page.evaluate(async () => {
      const { TimerManager } = await import('/content/webentwicklung/shared-utilities.js');
      const manager = new TimerManager();
      let count = 0;

      manager.setTimeout(() => count++, 50);
      manager.setInterval(() => count++, 50);

      const activeBefore = manager.activeCount;

      manager.clearAll();

      const activeAfter = manager.activeCount;

      await new Promise(resolve => setTimeout(resolve, 100));
      return { count, activeBefore, activeAfter };
    });
    expect(result.activeBefore).toBe(2);
    expect(result.activeAfter).toBe(0);
    expect(result.count).toBe(0);
  });

  test('Events system should dispatch and listen', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { fire, on } = await import('/content/webentwicklung/shared-utilities.js');
      let capturedDetail = null;

      const cleanup = on('test-event', (e) => {
        capturedDetail = e.detail;
      });

      fire('test-event', { foo: 'bar' });

      // Clean up to ensure no double firing logic bugs affecting this scope
      cleanup();

      return capturedDetail;
    });
    expect(result).toEqual({ foo: 'bar' });
  });

  test('Logger should respect default log level (warn)', async ({ page }) => {
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

    await page.evaluate(async () => {
      const { createLogger } = await import('/content/webentwicklung/shared-utilities.js');
      const logger = createLogger('TestDefault');
      logger.info('Should not appear');
      logger.warn('Should appear');
      logger.error('Should appear');
    });

    const texts = logs.map(l => l.text);
    const testLogs = texts.filter(t => t.includes('[TestDefault]'));

    expect(testLogs.some(t => t.includes('Should not appear'))).toBe(false);
    expect(testLogs.some(t => t.includes('Should appear'))).toBe(true);
  });

  test('Logger should respect debug mode', async ({ page }) => {
    // Reload page with debug param
    await page.goto('/?debug=true');

    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

    await page.evaluate(async () => {
      // Re-import to trigger initialization logic?
      // ES modules are cached.
      // But page.goto resets the context, so import will run fresh in the new page context.
      const { createLogger } = await import('/content/webentwicklung/shared-utilities.js');
      const logger = createLogger('TestDebug');
      logger.debug('Debug message');
    });

    const texts = logs.map(l => l.text);
    const testLogs = texts.filter(t => t.includes('[TestDebug]'));

    expect(testLogs.some(t => t.includes('Debug message'))).toBe(true);
  });
});
