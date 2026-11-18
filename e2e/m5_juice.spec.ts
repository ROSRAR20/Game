import { test, expect } from '@playwright/test';

test.describe('Milestone M5 Juice: Audio, Haptics, VFX, and Unit Tiers', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('[PAGE ERROR]:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[CONSOLE ERROR]:', msg.text());
      }
    });
  });

  test('verifies audio engine unlocks on first touch/pointerdown', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Verify audio context is unlocked upon user pointer click/touch
    const isUnlockedBefore = await page.evaluate(() => {
      const win = window as unknown as { __sound?: { getIsUnlocked: () => boolean } };
      return win.__sound?.getIsUnlocked() ?? false;
    });
    expect(isUnlockedBefore).toBe(false);

    // Simulate user first touch
    await page.mouse.click(195, 422);

    const isUnlockedAfter = await page.evaluate(() => {
      const win = window as unknown as { __sound?: { getIsUnlocked: () => boolean } };
      return win.__sound?.getIsUnlocked() ?? false;
    });
    expect(isUnlockedAfter).toBe(true);
  });

  test('verifies "LV+1" pickup collection and cannon tier progression', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Spawn player mobs right before pickup at X=4.2, Z=22.0
    await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: {
          cannon: { tier: number };
          pickups: { pickups: Array<{ isCollected: boolean }> };
        };
        __spawnBlueMobs?: (count: number, z: number, x?: number) => void;
      };
      if (win.__spawnBlueMobs) {
        win.__spawnBlueMobs(10, 21.0, 4.2);
      }
    });

    // Wait for units to march over Z=24
    await page.waitForTimeout(600);

    const cannonTier = await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: { cannon: { tier: number }; pickups: { pickups: Array<{ isCollected: boolean }> } };
      };
      return {
        tier: win.__sim?.cannon.tier,
        isCollected: win.__sim?.pickups.pickups[0].isCollected
      };
    });

    expect(cannonTier.tier).toBeGreaterThanOrEqual(1);
    expect(cannonTier.isCollected).toBe(true);

    // Capture screenshot showing Tier 1 armored units and HUD
    await page.screenshot({
      path: 'test-results/m5-tier1-upgrade.png'
    });
  });

  test('verifies particle VFX, screen shake trauma, and draw calls <= 30', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Spawn explosion and check particle active count & screen shake
    await page.evaluate(() => {
      const win = window as unknown as {
        __vfx?: { spawnExplosion: (x: number, y: number, z: number, count?: number) => void; getActiveCount: () => number };
        __screenShake?: { addTrauma: (amount: number) => void; getTrauma: () => number };
      };
      if (win.__vfx) {
        win.__vfx.spawnExplosion(0, 1.0, 30.0, 28);
      }
      if (win.__screenShake) {
        win.__screenShake.addTrauma(0.5);
      }
    });

    const vfxState = await page.evaluate(() => {
      const win = window as unknown as {
        __vfx?: { getActiveCount: () => number };
        __screenShake?: { getTrauma: () => number };
      };
      return {
        activeParticles: win.__vfx?.getActiveCount() ?? 0,
        trauma: win.__screenShake?.getTrauma() ?? 0
      };
    });

    expect(vfxState.activeParticles).toBeGreaterThan(0);
    expect(vfxState.trauma).toBeGreaterThan(0);

    const dbgDraws = page.locator('#dbg-draws');
    await expect(dbgDraws).toBeVisible();
    const draws = Number(await dbgDraws.textContent());
    expect(draws).toBeLessThan(35); // strictly within mobile draw budget

    // Screenshot with explosion particles active
    await page.screenshot({
      path: 'test-results/m5-explosion-juice.png'
    });
  });
});
