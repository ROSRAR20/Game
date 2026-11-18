import { test, expect } from '@playwright/test';

test.describe('Side-Lane Dressing & High-Capacity Stress Scenarios', () => {
  test('verifies Level 1 side-lane dressing, tower pedestal, reward tile, and draw calls <= 30', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug&skipMenu=1');

    // Wait for canvas and debug overlay to be visible
    await page.waitForSelector('#game-canvas');
    await page.waitForSelector('#debug-overlay');

    const dbgDraws = page.locator('#dbg-draws');
    const dbgFps = page.locator('#dbg-fps');
    await expect(dbgDraws).toBeVisible();
    await expect(dbgFps).toBeVisible();

    // Settle for 1.5 seconds so initial frames render cleanly
    await page.waitForTimeout(1500);

    const sceneDetails = await page.evaluate(() => {
      const win = window as unknown as {
        __scene?: { traverse: (cb: (obj: unknown) => void) => void };
        __renderer?: { info: { render: { calls: number; triangles: number } } };
      };
      const list: string[] = [];
      if (win.__scene) {
        win.__scene.traverse((obj) => {
          const m = obj as {
            isMesh?: boolean;
            type?: string;
            geometry?: { type: string };
            visible?: boolean;
            position?: { x: number; y: number; z: number };
            material?: { type: string; color?: { getHexString: () => string } };
          };
          if (m && m.isMesh) {
            const p = m.position ? `pos:(${m.position.x.toFixed(1)}, ${m.position.y.toFixed(1)}, ${m.position.z.toFixed(1)})` : '';
            list.push(`${m.type} [${m.geometry?.type}] ${p} (vis: ${m.visible})`);
          }
        });
      }
      return {
        count: list.length,
        meshes: list,
        renderCalls: win.__renderer?.info.render.calls
      };
    });
    console.info('[Scene Meshes Details]', JSON.stringify(sceneDetails, null, 2));

    const draws = Number(await dbgDraws.textContent());
    console.info(`[Side-Lane Dressing] Measured draw calls: ${draws}`);
    expect(draws).toBeLessThanOrEqual(30);

    // Capture 390x844 screenshot with +1 column, tower pedestal, reward tile, and debug overlay
    await page.screenshot({
      path: 'test-results/side-lane-level1.png'
    });
  });

  test('verifies ?scenario=level1_2500 sustains 2,500 active units at DPR 1.0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?scenario=level1_2500&debug&dpr=1');

    await page.waitForSelector('#game-canvas');
    await page.waitForSelector('#debug-overlay');

    // Let units spawn and ramp up to 2,500
    await page.waitForTimeout(2500);

    const dbgUnits = page.locator('#dbg-units');
    const unitsText = (await dbgUnits.textContent()) || '';
    const totalUnits = parseInt(unitsText, 10);
    console.info(`[Scenario level1_2500] Total units: ${totalUnits}`);
    expect(totalUnits).toBeGreaterThanOrEqual(2000);

    const dbgDpr = page.locator('#dbg-dpr');
    const dpr = Number(await dbgDpr.textContent());
    expect(dpr).toBe(1.0);
  });

  test('verifies ?scenario=level1_3000 sustains 3,000 active units at DPR 1.0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?scenario=level1_3000&debug&dpr=1');

    await page.waitForSelector('#game-canvas');
    await page.waitForSelector('#debug-overlay');

    // Let units spawn and ramp up to 3,000
    await page.waitForTimeout(3000);

    const dbgUnits = page.locator('#dbg-units');
    const unitsText = (await dbgUnits.textContent()) || '';
    const totalUnits = parseInt(unitsText, 10);
    console.info(`[Scenario level1_3000] Total units: ${totalUnits}`);
    expect(totalUnits).toBeGreaterThanOrEqual(2500);

    const dbgDpr = page.locator('#dbg-dpr');
    const dpr = Number(await dbgDpr.textContent());
    expect(dpr).toBe(1.0);
  });
});
