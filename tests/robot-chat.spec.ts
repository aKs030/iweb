import {test, expect} from '@playwright/test';

test.describe('Robot Chat', () => {
  test('responds to simple user message', async ({page}) => {
    await page.setViewportSize({width: 1280, height: 800});
    await page.goto('/');

    // Open chat
    await page.click('.robot-avatar');
    const chatWindow = page.locator('#robot-chat-window');
    await expect(chatWindow).toBeVisible();

    // Send a simple greeting and expect a bot reply (fallback should trigger when no API key)
    await page.fill('#robot-chat-input', 'Hallo');
    await page.click('#robot-chat-send');

    await page.waitForSelector('.message.bot', {timeout: 3000});
    const botMsg = page.locator('.message.bot');
    await expect(await botMsg.count()).toBeGreaterThan(0);
    await expect(botMsg.first()).toBeVisible();
  });
});
