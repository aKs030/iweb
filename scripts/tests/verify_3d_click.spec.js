import { test, expect } from '@playwright/test';

test('Verify 3D Card Click Logic', async ({ page }) => {
  // 1. Navigate to home with forceThree to ensure WebGL is active
  await page.goto('/?forceThree=1&debug=true');

  // 2. Wait for CardManager
  await page.waitForFunction(() => window.threeEarthSystem && window.threeEarthSystem.cardManager && window.threeEarthSystem.cardManager.cards.length > 0);

  // 3. Test Hit Detection directly
  const hitResult = await page.evaluate(() => {
    const cm = window.threeEarthSystem.cardManager;
    const card = cm.cards[0]; // "Über mich" card

    // Project card position to NDC (Normalized Device Coordinates)
    const pos = card.position.clone();
    pos.project(cm.camera);

    // Simulate mouse exactly at card center
    const mouse = { x: pos.x, y: pos.y };

    // Call the detection method
    const detected = cm.getHoveredCardFromScreen(mouse);

    return {
      cardId: card.userData.id,
      detectedId: detected ? detected.userData.id : null,
      mouse: mouse,
      screenPos: pos
    };
  });

  console.log('Hit Test Result:', hitResult);

  // 4. Assert that the card is detected
  expect(hitResult.detectedId).toBe(hitResult.cardId);
});
