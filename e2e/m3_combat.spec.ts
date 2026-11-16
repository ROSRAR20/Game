import { test, expect } from '@playwright/test';

test.describe('Milestone M3 Combat & Base Defense Verification', () => {
  test('verifies live wave combat, base HP bar, and debug overlay metrics', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Verify Base HP Bar is visible and positioned
    const baseHpContainer = page.locator('#base-hp-container');
    await expect(baseHpContainer).toBeVisible();
    const baseHpText = page.locator('#base-hp-text');
    await expect(baseHpText).toHaveText('100 / 100');

    // Wait for Wave 1 to trigger at t=2.0s and mobs to clash
    await page.waitForTimeout(3500);

    // Verify debug overlay metrics
    const debugOverlay = page.locator('#debug-overlay');
    await expect(debugOverlay).toBeVisible();

    const dbgBlue = page.locator('#dbg-blue');
    const dbgRed = page.locator('#dbg-red');
    const dbgBaseHp = page.locator('#dbg-base-hp');
    const dbgDraws = page.locator('#dbg-draws');

    await expect(dbgBlue).toBeVisible();
    await expect(dbgRed).toBeVisible();
    await expect(dbgBaseHp).toBeVisible();

    const draws = Number(await dbgDraws.textContent());
    expect(draws).toBeLessThan(100);

    await page.screenshot({
      path: 'test-results/m3-gameplay-combat.png'
    });
  });

  test('verifies ?scenario=combat keeps ~1,000 Blue and ~1,000 Red in combat', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?scenario=combat&debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Allow continuous replenishment to reach ~1,000 vs ~1,000
    await page.waitForTimeout(2500);

    const dbgBlue = page.locator('#dbg-blue');
    const dbgRed = page.locator('#dbg-red');
    const dbgUnits = page.locator('#dbg-units');
    const dbgDraws = page.locator('#dbg-draws');
    const dbgFps = page.locator('#dbg-fps');

    const blueCount = Number(await dbgBlue.textContent());
    const redCount = Number(await dbgRed.textContent());
    const unitsText = await dbgUnits.textContent();
    const draws = Number(await dbgDraws.textContent());
    const fps = Number(await dbgFps.textContent());

    expect(blueCount).toBeGreaterThan(800);
    expect(redCount).toBeGreaterThan(800);
    expect(blueCount + redCount).toBeGreaterThan(1800);
    expect(draws).toBeLessThan(100);
    expect(fps).toBeGreaterThanOrEqual(30);

    console.info(`[Combat Stress Metrics] Blue: ${blueCount}, Red: ${redCount}, Total: ${unitsText}, Draws: ${draws}, FPS: ${fps}`);

    await page.screenshot({
      path: 'test-results/m3-scenario-combat-2000.png'
    });
  });

  test('verifies Game Over modal and Restart button touch target (>= 48 dp)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Trigger game over via window hook
    await page.evaluate(() => {
      // Simulate lethal base damage
      const win = window as unknown as { __triggerGameOver?: () => void };
      if (win.__triggerGameOver) {
        win.__triggerGameOver();
      }
    });

    const restartBtn = page.locator('#btn-restart');
    await expect(restartBtn).toBeAttached();

    // Check button bounding box for >= 48dp requirement
    const box = await restartBtn.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(48);
    }

    await page.screenshot({
      path: 'test-results/m3-game-over.png'
    });
  });
});
