import { test, expect } from '@playwright/test';

test('captures 390x844 screenshot with ?debugLanes and ?debug overlay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?skipMenu&debug&debugLanes');

  const container = page.locator('#game-container');
  await expect(container).toBeVisible();

  // Wait for rendering to stabilize
  await page.waitForTimeout(1000);

  // Extract raycast ground range from debug overlay / window
  const metrics = await page.evaluate(() => {
    const draws = document.getElementById('dbg-draws')?.textContent;
    const fps = document.getElementById('dbg-fps')?.textContent;
    const zRange = document.getElementById('dbg-zrange')?.textContent;
    return { draws, fps, zRange };
  });

  console.log('--- ?debugLanes LIVE METRICS ---', metrics);

  // Capture screenshot to artifacts folder and test-results
  await page.screenshot({
    path: 'test-results/debug-lanes-390x844.png'
  });
});
