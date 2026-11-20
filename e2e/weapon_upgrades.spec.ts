import { test, expect } from '@playwright/test';

test.describe('Weapon Upgrades & Power-Ups (Level 1)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('[PAGE ERROR]:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[CONSOLE ERROR]:', msg.text());
      }
    });
  });

  test('verifies Level 1 upgrade crate, 3 visible weapon tiers, and draw calls <= 30', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?skipMenu&debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Verify initial Tier 0 state
    const initialTier = await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: {
          cannon: { tier: number };
          towers: { towers: Array<{ id: number; hp: number; rewardType: string; isDestroyed: boolean }> };
        };
      };
      const crate = win.__sim?.towers.towers.find((t) => t.rewardType === 'upgrade');
      return {
        tier: win.__sim?.cannon.tier,
        crateHp: crate?.hp,
        crateDestroyed: crate?.isDestroyed
      };
    });

    expect(initialTier.tier).toBe(0);
    expect(initialTier.crateHp).toBe(5);
    expect(initialTier.crateDestroyed).toBe(false);

    // Verify HUD reflects 1 primary tower (excludes optional crate)
    const objTowers = page.locator('#obj-towers');
    await expect(objTowers).toHaveText(/TOWER: 1/);

    // Check draw calls at Tier 0
    const dbgDraws = page.locator('#dbg-draws');
    await expect(dbgDraws).toBeVisible();
    await page.waitForTimeout(600);
    const drawsT0 = Number(await dbgDraws.textContent());
    expect(drawsT0).toBeLessThan(35);
    expect(drawsT0).toBeLessThanOrEqual(30);

    // Capture Tier 0 screenshot
    await page.screenshot({
      path: 'test-results/tier0-single-cannon.png'
    });

    // 1. Move cannon to X = -4.5 to hit crate
    await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: { cannon: { setTargetX: (x: number) => void } };
      };
      if (win.__sim) {
        win.__sim.cannon.setTargetX(-4.5);
      }
    });

    // Wait 2.2 seconds for bullets to reach and break crate
    await page.waitForTimeout(2200);

    const tier1State = await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: {
          cannon: { tier: number };
          towers: { towers: Array<{ id: number; hp: number; rewardType: string; isDestroyed: boolean }> };
        };
      };
      const crate = win.__sim?.towers.towers.find((t) => t.rewardType === 'upgrade');
      return {
        tier: win.__sim?.cannon.tier,
        crateHp: crate?.hp,
        crateDestroyed: crate?.isDestroyed
      };
    });

    expect(tier1State.crateDestroyed).toBe(true);
    expect(tier1State.tier).toBe(1);

    const drawsT1 = Number(await dbgDraws.textContent());
    expect(drawsT1).toBeLessThan(35);
    expect(drawsT1).toBeLessThanOrEqual(30);

    // Capture Tier 1 screenshot
    await page.screenshot({
      path: 'test-results/tier1-triple-cannon.png'
    });

    // 2. Steer back to center (X = 0) to collect LV+1 Gem at Z = 24
    await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: { cannon: { setTargetX: (x: number) => void } };
      };
      if (win.__sim) {
        win.__sim.cannon.setTargetX(0.0);
      }
    });

    // Wait 2.5 seconds for units to march over Z = 24
    await page.waitForTimeout(2500);

    const tier2State = await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: { cannon: { tier: number } };
      };
      return win.__sim?.cannon.tier;
    });

    expect(tier2State).toBe(2);

    const drawsT2 = Number(await dbgDraws.textContent());
    expect(drawsT2).toBeLessThan(35);
    expect(drawsT2).toBeLessThanOrEqual(30);

    // Capture Tier 2 screenshot
    await page.screenshot({
      path: 'test-results/tier2-squad-cannon.png'
    });
  });

  test('verifies ?scenario=tier2_2000 initializes Tier 2 squad with ~2,000 active units at DPR 1.0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?scenario=tier2_2000&debug&dpr=1');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: { cannon: { tier: number }; pool: { count: number } };
      };
      return {
        tier: win.__sim?.cannon.tier,
        count: win.__sim?.pool.count
      };
    });

    expect(state.tier).toBe(2);
    expect(state.count).toBeGreaterThanOrEqual(1800);

    const dbgDraws = page.locator('#dbg-draws');
    await expect(dbgDraws).toBeVisible();
    const draws = Number(await dbgDraws.textContent());
    expect(draws).toBeLessThan(35);
    expect(draws).toBeLessThanOrEqual(30);

    // Capture scenario screenshot
    await page.screenshot({
      path: 'test-results/tier2-scenario-2000.png'
    });
  });
});

