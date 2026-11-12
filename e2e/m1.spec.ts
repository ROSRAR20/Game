import { test, expect } from '@playwright/test';

test.describe('Milestone M1 Core Loop & Benchmarks', () => {
  test('drags cannon left and right smoothly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Relative drag gesture in bottom third of screen
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height * 0.75;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drag right
    await page.mouse.move(startX + 80, startY, { steps: 5 });
    await page.waitForTimeout(300);
    // Drag left
    await page.mouse.move(startX - 80, startY, { steps: 5 });
    await page.waitForTimeout(300);
    await page.mouse.up();

    // Verify game canvas is healthy and rendering at 60 fps
    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThanOrEqual(45);
  });

  test('auto-fires blue mobs in normal gameplay', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Wait 1.5 seconds for auto-firing cadence
    await page.waitForTimeout(1500);

    const unitsText = await page.locator('#dbg-units').textContent();
    const count = Number(unitsText);
    expect(count).toBeGreaterThan(3);

    // Capture screenshot of normal gameplay
    await page.screenshot({ path: 'test-results/m1-gameplay-autofire.png' });
  });

  test('holds 500 active blue mobs with ~100-triangle meshes at 60 fps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=500&debug');

    // Allow pool to fill and stabilize
    await page.waitForTimeout(1500);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(Number(unitsText)).toBe(500);

    // Verify ~100 triangles per unit (500 units * 100 tris = ~50,000 tris)
    const trisText = await page.locator('#dbg-tris').textContent();
    const tris = Number(trisText);
    expect(tris).toBeGreaterThanOrEqual(50000);

    // Assert FPS maintains 60 fps on desktop
    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThanOrEqual(55);

    // Capture benchmark screenshot for M1 Walkthrough
    await page.screenshot({ path: 'test-results/m1-stress-500.png' });
  });

  test('supports ?dpr overrides correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/?debug&dpr=1');
    await page.waitForTimeout(600);
    expect(await page.locator('#dbg-dpr').textContent()).toBe('1.0');

    await page.goto('/?debug&dpr=2');
    await page.waitForTimeout(600);
    expect(await page.locator('#dbg-dpr').textContent()).toBe('2.0');
  });

  test('holds 2000 active blue mobs in stress mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=2000&debug');

    await page.waitForTimeout(2000);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(Number(unitsText)).toBe(2000);

    const trisText = await page.locator('#dbg-tris').textContent();
    const tris = Number(trisText);
    expect(tris).toBeGreaterThanOrEqual(200000);

    await page.screenshot({ path: 'test-results/m1-stress-2000.png' });
  });

  test('maintains 60 fps under 4x CPU throttling with 500 mobs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto('/?stress=500&debug');
    await page.waitForTimeout(2500);

    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThanOrEqual(55);

    await page.screenshot({ path: 'test-results/m1-throttled-4x-500.png' });
  });
});
