import { test, expect } from '@playwright/test';

test('captures M3 Task 0 diagonal camera pass screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?debug');

  const container = page.locator('#game-container');
  await expect(container).toBeVisible();

  // Wait 2.5s for auto-fire to send a stream of blue mobs towards the first gates
  await page.waitForTimeout(2500);

  // Verify debug overlay is present and running smoothly
  const fpsText = await page.locator('#dbg-fps').textContent();
  expect(Number(fpsText)).toBeGreaterThanOrEqual(45);

  // Capture screenshot of the full framing: cannon at bottom, road diagonal, gates, far-field horde carpet at top
  await page.screenshot({ path: 'test-results/m3-task0-camera-pass.png' });
});
