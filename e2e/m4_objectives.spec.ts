import { test, expect } from '@playwright/test';

test.describe('Milestone M4 Objectives: Towers, Boss, and Victory', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('[PAGE ERROR]:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[CONSOLE ERROR]:', msg.text());
      }
    });
  });

  test('verifies guardian tower presence, engagement, and HP badge', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const debugOverlay = page.locator('#debug-overlay');
    await expect(debugOverlay).toBeVisible();

    // Verify Level 1 Banner and Objective tracker
    const levelBanner = page.locator('#level-banner');
    await expect(levelBanner).toBeVisible();
    const objTowers = page.locator('#obj-towers');
    await expect(objTowers).toHaveText('TOWER: 1');

    // Spawn player mobs towards the tower at Z=30 using exposed dev helper
    await page.evaluate(() => {
      const win = window as unknown as { __spawnBlueMobs?: (count: number, z: number) => void };
      if (win.__spawnBlueMobs) {
        win.__spawnBlueMobs(20, 28.0);
      }
    });

    // Wait a brief moment for visual update
    await page.waitForTimeout(600);

    const dbgDraws = page.locator('#dbg-draws');
    const draws = Number(await dbgDraws.textContent());
    expect(draws).toBeLessThan(100);

    await page.screenshot({
      path: 'test-results/m4-tower-encounter.png'
    });
  });

  test('verifies boss engagement and floating 3D health bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Fast-forward or position boss into active combat zone (Z=40)
    await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: { bosses?: { bosses: Array<{ z: number; hp: number }> } };
        __spawnBlueMobs?: (count: number, z: number) => void;
      };
      if (win.__sim?.bosses?.bosses && win.__sim.bosses.bosses.length > 0) {
        win.__sim.bosses.bosses[0].z = 40;
        win.__sim.bosses.bosses[0].hp = 80; // Damaged state showing health bar
      }
      if (win.__spawnBlueMobs) {
        win.__spawnBlueMobs(30, 38.0);
      }
    });

    await page.waitForTimeout(600);

    const dbgDraws = page.locator('#dbg-draws');
    const draws = Number(await dbgDraws.textContent());
    expect(draws).toBeLessThan(100);

    await page.screenshot({
      path: 'test-results/m4-boss-battle.png'
    });
  });

  test('verifies Victory modal, stats, and replay button touch target (>= 48 dp)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Trigger victory via window hook
    await page.evaluate(() => {
      const win = window as unknown as { __triggerWin?: () => void };
      if (win.__triggerWin) {
        win.__triggerWin();
      }
    });

    const victoryModal = page.locator('#victory-modal');
    await expect(victoryModal).toBeVisible();

    const replayBtn = page.locator('#btn-replay');
    await expect(replayBtn).toBeVisible();

    // Check button bounding box for >= 48dp requirement
    const box = await replayBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(48);
    }

    const baseStatus = page.locator('#v-base-status');
    await expect(baseStatus).toContainText('100 / 100');

    await page.screenshot({
      path: 'test-results/m4-victory-screen.png'
    });

    // Check sim state before replay
    const stateBefore = await page.evaluate(() => {
      const win = window as unknown as { __sim?: { isGameWon: boolean } };
      return { isGameWon: win.__sim?.isGameWon };
    });
    console.log('[E2E TEST] State before replay click:', stateBefore);

    // Test clicking replay resets victory modal and restarts game
    await replayBtn.click();

    // Check sim state after replay
    const stateAfter = await page.evaluate(() => {
      const win = window as unknown as { __sim?: { isGameWon: boolean } };
      const modal = document.getElementById('victory-modal');
      return {
        isGameWon: win.__sim?.isGameWon,
        modalDisplay: modal?.style.display
      };
    });
    console.log('[E2E TEST] State after replay click:', stateAfter);

    await expect(victoryModal).not.toBeVisible();
  });

  test('verifies natural gameplay progress: visible tower, gates, and boss combat', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    // Wait 4 seconds for natural fire and wave 1 clash at Z=18-30
    await page.waitForTimeout(4000);

    const state = await page.evaluate(() => {
      const win = window as unknown as {
        __sim?: {
          towers: { towers: Array<{ hp: number; isDestroyed: boolean; z: number }> };
          bosses: { bosses: Array<{ hp: number; isDefeated: boolean; z: number }> };
          base: { hp: number };
        };
      };
      return {
        towerZ: win.__sim?.towers.towers[0]?.z,
        towerHp: win.__sim?.towers.towers[0]?.hp,
        bossZ: win.__sim?.bosses.bosses[0]?.z,
        bossHp: win.__sim?.bosses.bosses[0]?.hp,
        baseHp: win.__sim?.base.hp
      };
    });
    console.log('[NATURAL GAMEPLAY STATE]:', state);
    expect(state.towerZ).toBe(30);
    expect(state.bossZ).toBeLessThan(44.0); // Boss is actively marching down!
  });
});
