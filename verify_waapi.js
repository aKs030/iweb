import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3001');

  // Wait for fly-in
  await page.waitForTimeout(2000);

  const robot = await page.locator('#robot-companion-container');
  const isVisible = await robot.isVisible();
  console.log('Robot visible after fly-in:', isVisible);
  await robot.screenshot({ path: 'robot_waapi_present.png' });

  // Open chat
  const avatar = await page.locator('.robot-avatar');
  await avatar.click();
  await page.waitForTimeout(1000);

  const chat = await page.locator('.robot-chat-window');
  const chatVisible = await chat.isVisible();
  console.log('Chat visible after click:', chatVisible);
  await chat.screenshot({ path: 'chat_waapi_open.png' });

  await browser.close();
}

verify().catch(console.error);
