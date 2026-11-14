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

  test('auto-fires blue mobs in normal gameplay and renders visible units', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Wait 1.5 seconds for auto-firing cadence
    await page.waitForTimeout(1500);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(unitsText).toMatch(/\d+ \(vis: \d+\)/);

    const visMatch = unitsText?.match(/\(vis: (\d+)\)/);
    const visCount = Number(visMatch?.[1]);
    expect(visCount).toBeGreaterThan(0);

    // Capture screenshot of normal gameplay
    await page.screenshot({ path: 'test-results/m1-gameplay-autofire.png' });
  });

  test('asserts that blue mob pixels are physically present on the road while firing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Allow auto-fire to send several blue mobs up the road
    await page.waitForTimeout(1800);

    // Read WebGL backbuffer pixels in the road area ahead of the cannon
    const bluePixelCount = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return -1;

      const w = canvas.width;
      const h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // In WebGL texture coordinates, row 0 is bottom, row h-1 is top.
      // With diagonal camera perspective, the road runs from lower-left to upper-right.
      // Road area ahead of cannon where mobs travel: rows 0.20h to 0.75h.
      // Horizontal span covering the diagonal road: columns 0.15w to 0.95w.
      let count = 0;
      const minRow = Math.floor(h * 0.20);
      const maxRow = Math.floor(h * 0.75);
      const minCol = Math.floor(w * 0.15);
      const maxCol = Math.floor(w * 0.95);

      for (let row = minRow; row < maxRow; row++) {
        for (let col = minCol; col < maxCol; col++) {
          const idx = (row * w + col) * 4;
          const r = pixels[idx]!;
          const g = pixels[idx + 1]!;
          const b = pixels[idx + 2]!;

          // Blue mob pixel discrimination:
          // Bright cyan/sky blue has high blue and significant green, with low red.
          // Dark asphalt has r~30, g~41, b~59 (rejected).
          if (b > 130 && b > r + 40 && g > 90) {
            count++;
          }
        }
      }
      return count;
    });

    // Assert that blue mob pixels are genuinely present on the road
    expect(bluePixelCount).toBeGreaterThan(50);

    // Save screenshot for Walkthrough verification
    await page.screenshot({ path: 'test-results/m1-blue-pixels-verified.png' });
  });

  test('holds 500 active blue mobs with ~100-triangle meshes at 60 fps with high frustum visibility', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=500&debug');

    // Allow pool to fill and stabilize
    await page.waitForTimeout(1500);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(unitsText).toMatch(/^500 \(vis: \d+\)$/);

    const visMatch = unitsText?.match(/\(vis: (\d+)\)/);
    const visCount = Number(visMatch?.[1]);
    // Almost all 500 mobs should be inside the view frustum spanning the road
    expect(visCount).toBeGreaterThanOrEqual(400);

    // Verify ~100 triangles per unit (500 units * 100 tris = ~50,000 tris)
    const trisText = await page.locator('#dbg-tris').textContent();
    const tris = Number(trisText);
    expect(tris).toBeGreaterThanOrEqual(50000);

    // Assert FPS maintains 60 fps on desktop
    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThanOrEqual(55);

    // Verify blue pixels in stress mode covering road
    const bluePixelsInStress = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 0;

      const w = canvas.width;
      const h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let count = 0;
      const minRow = Math.floor(h * 0.30);
      const maxRow = Math.floor(h * 0.70);
      const minCol = Math.floor(w * 0.25);
      const maxCol = Math.floor(w * 0.75);

      for (let row = minRow; row < maxRow; row++) {
        for (let col = minCol; col < maxCol; col++) {
          const idx = (row * w + col) * 4;
          const r = pixels[idx]!;
          const g = pixels[idx + 1]!;
          const b = pixels[idx + 2]!;
          if (b > 130 && b > r + 40 && g > 90) {
            count++;
          }
        }
      }
      return count;
    });

    // In 500 mobs stress mode, thousands of blue pixels must cover the road
    expect(bluePixelsInStress).toBeGreaterThan(1000);

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

  test('holds 2000 active blue mobs in stress mode with high visible count', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=2000&debug');

    await page.waitForTimeout(2000);

    const unitsText = await page.locator('#dbg-units').textContent();
    expect(unitsText).toMatch(/^2000 \(vis: \d+\)$/);

    const visMatch = unitsText?.match(/\(vis: (\d+)\)/);
    const visCount = Number(visMatch?.[1]);
    expect(visCount).toBeGreaterThanOrEqual(1600);

    const trisText = await page.locator('#dbg-tris').textContent();
    const tris = Number(trisText);
    expect(tris).toBeGreaterThanOrEqual(200000);

    await page.screenshot({ path: 'test-results/m1-stress-2000.png' });
  });

  test('maintains high fps under 4x CPU throttling with 500 mobs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?stress=500&debug');

    // Enable 4x CPU throttling to evaluate runtime sim & render performance
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.waitForTimeout(3000);

    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThanOrEqual(40);

    await page.screenshot({ path: 'test-results/m1-throttled-4x-500.png' });
  });
});
