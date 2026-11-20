import { test, expect } from '@playwright/test';

interface SimWindow {
  __sim?: {
    cannon: {
      x: number;
      tier: number;
      setTargetX: (x: number) => void;
    };
    pool: {
      count: number;
    };
    towers: {
      towers: Array<{
        id: number;
        hp: number;
        rewardType: string;
        isDestroyed: boolean;
      }>;
    };
  };
}

test.describe('Weapon Upgrades & Power-Ups (Level 1)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('[PAGE ERROR]:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[CONSOLE ERROR]:', msg.text());
      }
    });
  });

  test('Tier 0: Single Cannon visual, HUD, and draw calls <= 30', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?skipMenu&debug&tier=0');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const state = await page.evaluate(() => {
      const win = window as unknown as SimWindow;
      const crate = win.__sim?.towers.towers.find((t) => t.rewardType === 'upgrade');
      return {
        tier: win.__sim?.cannon.tier,
        crateHp: crate?.hp,
        crateDestroyed: crate?.isDestroyed
      };
    });

    expect(state.tier).toBe(0);
    expect(state.crateHp).toBe(5);
    expect(state.crateDestroyed).toBe(false);

    // Verify HUD reflects 1 primary tower (excludes optional crate)
    const objTowers = page.locator('#obj-towers');
    await expect(objTowers).toHaveText(/TOWER: 1/);

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
  });

  test('Tier 1: Clustered Triple Cannon visual and draw calls <= 30', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?skipMenu&debug&tier=1');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const tier = await page.evaluate(() => {
      const win = window as unknown as SimWindow;
      return win.__sim?.cannon.tier;
    });
    expect(tier).toBe(1);

    const dbgDraws = page.locator('#dbg-draws');
    await expect(dbgDraws).toBeVisible();
    await page.waitForTimeout(600);

    const drawsT1 = Number(await dbgDraws.textContent());
    expect(drawsT1).toBeLessThan(35);
    expect(drawsT1).toBeLessThanOrEqual(30);

    // Capture Tier 1 screenshot
    await page.screenshot({
      path: 'test-results/tier1-triple-cannon.png'
    });
  });

  test('Tier 2: Squad Cannon visual and draw calls <= 30', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?skipMenu&debug&tier=2');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const tier = await page.evaluate(() => {
      const win = window as unknown as SimWindow;
      return win.__sim?.cannon.tier;
    });
    expect(tier).toBe(2);

    const dbgDraws = page.locator('#dbg-draws');
    await expect(dbgDraws).toBeVisible();
    await page.waitForTimeout(600);

    const drawsT2 = Number(await dbgDraws.textContent());
    expect(drawsT2).toBeLessThan(35);
    expect(drawsT2).toBeLessThanOrEqual(30);

    // Capture Tier 2 screenshot
    await page.screenshot({
      path: 'test-results/tier2-squad-cannon.png'
    });
  });

  test('Upgrade Crate: breaking crate triggers cannon upgrade to Tier 1', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?skipMenu&debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Move cannon to X = -4.5 immediately to target the crate at (X=-4.5, Z=12)
    await page.evaluate(() => {
      const win = window as unknown as SimWindow;
      if (win.__sim) {
        win.__sim.cannon.x = -4.5;
        win.__sim.cannon.setTargetX(-4.5);
      }
    });

    // Wait for bullets to reach and break crate (5 hits at 6 shots/s = ~1.5s)
    await page.waitForTimeout(2000);

    const crateState = await page.evaluate(() => {
      const win = window as unknown as SimWindow;
      const crate = win.__sim?.towers.towers.find((t) => t.rewardType === 'upgrade');
      return {
        tier: win.__sim?.cannon.tier,
        crateHp: crate?.hp,
        crateDestroyed: crate?.isDestroyed
      };
    });

    expect(crateState.crateDestroyed).toBe(true);
    expect(crateState.crateHp).toBe(0);
    expect(crateState.tier).toBeGreaterThanOrEqual(1);
  });

  test('Scenario: ?scenario=tier2_2000 initializes Tier 2 squad with ~2,000 active units at DPR 1.0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?scenario=tier2_2000&debug&dpr=1');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => {
      const win = window as unknown as SimWindow;
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
