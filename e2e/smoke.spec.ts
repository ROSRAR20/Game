import { test, expect } from '@playwright/test';

test.describe('M0 Baseline Smoke & Visuals', () => {
  test('renders 390x844 portrait canvas and debug overlay', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    const debugOverlay = page.locator('#debug-overlay');
    await expect(debugOverlay).toBeVisible();

    // Allow canvas rendering to produce at least a couple frames
    await page.waitForTimeout(1000);

    // Verify debug metrics have updated from initial placeholder
    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThan(0);

    // Capture screenshot for M0 Walkthrough
    await page.screenshot({ path: 'test-results/m0-portrait-baseline.png' });
  });

  test('activates bare stress test mode with ?stress=500', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=500');

    const debugOverlay = page.locator('#debug-overlay');
    await expect(debugOverlay).toBeVisible();

    await page.waitForTimeout(1000);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(parseInt(unitsText || '0', 10)).toBe(500);

    // Capture screenshot of stress mode
    await page.screenshot({ path: 'test-results/m0-bare-stress-500.png' });
  });

  test('activates bare stress test mode with ?stress=2000', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=2000');

    const debugOverlay = page.locator('#debug-overlay');
    await expect(debugOverlay).toBeVisible();

    await page.waitForTimeout(1000);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(parseInt(unitsText || '0', 10)).toBe(2000);

    await page.screenshot({ path: 'test-results/m0-bare-stress-2000.png' });
  });
});
