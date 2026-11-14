import { test, expect } from '@playwright/test';

test.describe('M3 Task 0 Camera Presets Capture (?stress=2000)', () => {
  for (const preset of ['a', 'b', 'c'] as const) {
    test(`captures preset ${preset} with ?stress=2000&debug`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/?camPreset=${preset}&stress=2000&debug`);

      const container = page.locator('#game-container');
      await expect(container).toBeVisible();

      // Wait 1.5s for stress mobs to populate the track
      await page.waitForTimeout(1500);

      const fpsText = await page.locator('#dbg-fps').textContent();
      expect(Number(fpsText)).toBeGreaterThanOrEqual(40);

      const unitsText = await page.locator('#dbg-units').textContent();
      expect(unitsText).toContain('2000');

      await page.screenshot({
        path: `test-results/m3-task0-preset-${preset}.png`
      });
    });
  }
});
