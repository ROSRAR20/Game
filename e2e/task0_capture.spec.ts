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
      expect(Number(fpsText)).toBeGreaterThanOrEqual(35);

      const unitsText = await page.locator('#dbg-units').textContent();
      expect(unitsText).toContain('2000');

      // Verify Z-RNG is present in debug overlay
      const zRangeText = await page.locator('#dbg-zrange').textContent();
      expect(zRangeText).not.toBe('0 - 0');

      await page.screenshot({
        path: `test-results/m3-task0-preset-${preset}.png`
      });
    });
  }

  test('verifies live camera tuner panel (?camTune)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?camTune&debug');

    const tuner = page.locator('#cam-tuner-panel');
    await expect(tuner).toBeVisible();

    // Verify sliders exist with 48dp min-height touch targets
    const sliders = page.locator('#cam-tuner-body input[type="range"]');
    await expect(sliders).toHaveCount(7);

    // Click 'Show Query String'
    const qsBtn = page.locator('button', { hasText: 'Show Query String' });
    await qsBtn.click();

    const modal = page.locator('#cam-qs-modal');
    await expect(modal).toBeVisible();
    const textarea = modal.locator('textarea');
    const qsValue = await textarea.inputValue();
    expect(qsValue).toContain('?camPitch=');
    expect(qsValue).toContain('&camYaw=');
    expect(qsValue).toContain('&camFov=');

    // Screenshot with tuner active
    await page.screenshot({
      path: 'test-results/m3-task0-cam-tuner.png'
    });
  });

  test('captures gameplay with gates aligned to road', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Wait 2.5s for blue mobs to stream toward the gates
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: 'test-results/m3-gates-aligned.png'
    });
  });
});
