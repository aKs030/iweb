import { test, expect } from '@playwright/test';

test('SectionTracker should correctly handle partial updates from IntersectionObserver', async ({
  page
}) => {
  await page.goto('/');
  await page.waitForSelector('#hero');

  // We will inject a script to test the SectionTracker instance directly.
  // We simulate the behavior where the observer reports one section changing,
  // but another section (already visible) is not reported.

  const result = await page.evaluate(() => {
    const tracker = window.sectionTracker;

    // Mock the dispatchSectionChange to track calls
    const calls = [];
    const originalDispatch = tracker.dispatchSectionChange.bind(tracker);
    tracker.dispatchSectionChange = (id) => {
      calls.push(id);
      return originalDispatch(id);
    };

    // 1. Simulate initial state where 'hero' is fully visible (1.0)
    // The tracker should interpret this as 'hero' being active.
    const entryHeroFull = {
      target: { id: 'hero' },
      isIntersecting: true,
      intersectionRatio: 1.0
    };
    tracker.handleIntersections([entryHeroFull]);

    const initialSection = tracker.currentSectionId; // Should be 'hero'

    // 2. Simulate a scroll where 'features' enters slightly (0.2)
    // AND 'hero' reduces slightly (0.8).
    // CRITICAL: The IntersectionObserver callback might only report 'features'
    // if 'hero' didn't cross a threshold.
    // We simulate this by ONLY passing 'features' to handleIntersections.

    const entryFeaturesPartial = {
      target: { id: 'features' },
      isIntersecting: true,
      intersectionRatio: 0.2
    };

    // Pass ONLY features. Hero is implicitly still at 1.0 (or 0.8 in reality, but the tracker doesn't know!)
    // Wait, the tracker DOES know about Hero from step 1, because we added memory (sectionRatios).
    // Hero entry in memory: Ratio 1.0.
    // Features entry (new): Ratio 0.2.
    // Logic compares Hero(1.0) vs Features(0.2). Hero wins.
    tracker.handleIntersections([entryFeaturesPartial]);

    const fixedSection = tracker.currentSectionId; // Should be 'hero'

    // 3. Simulate further scroll where 'features' becomes dominant.
    // Features -> 0.6. Hero -> 0.4.
    // Report both? Or just one?
    // Let's report both to be sure state updates.
    const entryFeaturesDominant = {
      target: { id: 'features' },
      isIntersecting: true,
      intersectionRatio: 0.6
    };
    const entryHeroReceding = {
      target: { id: 'hero' },
      isIntersecting: true,
      intersectionRatio: 0.4
    };

    tracker.handleIntersections([entryFeaturesDominant, entryHeroReceding]);
    const finalSection = tracker.currentSectionId; // Should be 'features'

    return {
      initial: initialSection,
      fixedResult: fixedSection,
      final: finalSection,
      calls
    };
  });

  // Verification
  expect(result.initial).toBe('hero');
  expect(result.fixedResult).toBe('hero'); // This confirms the fix!
  expect(result.final).toBe('features');
});
