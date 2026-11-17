import { test, expect } from '@playwright/test';

test.describe('Milestone M6 Release: Menus, Campaign Progression & Durable Saves', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('[PAGE ERROR]:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[CONSOLE ERROR]:', msg.text());
      }
    });
  });

  test('verifies Main Menu presentation and accessible touch targets (>= 48 dp)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).toBeVisible();

    const btnPlay = page.locator('#btn-play');
    await expect(btnPlay).toBeVisible();
    const playBox = await btnPlay.boundingBox();
    expect(playBox).not.toBeNull();
    expect(playBox!.height).toBeGreaterThanOrEqual(48);

    const btnLevelSelect = page.locator('#btn-level-select');
    await expect(btnLevelSelect).toBeVisible();
    const selectBox = await btnLevelSelect.boundingBox();
    expect(selectBox).not.toBeNull();
    expect(selectBox!.height).toBeGreaterThanOrEqual(48);

    const btnSound = page.locator('#btn-sound-toggle');
    await expect(btnSound).toBeVisible();
    await btnSound.click();
    await expect(btnSound).toHaveText('🔇 SOUND: OFF');
    await btnSound.click();
    await expect(btnSound).toHaveText('🔊 SOUND: ON');

    await page.screenshot({
      path: 'test-results/m6-main-menu.png'
    });
  });

  test('verifies Level Select modal with 5 campaign levels and status badges', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const btnLevelSelect = page.locator('#btn-level-select');
    await btnLevelSelect.click();

    const levelSelectModal = page.locator('#level-select-modal');
    await expect(levelSelectModal).toBeVisible();

    const levelCards = page.locator('.level-card');
    await expect(levelCards).toHaveCount(5);

    // Level 1 is always unlocked
    const card1 = page.locator('.level-card[data-level="1"]');
    await expect(card1).toHaveClass(/unlocked/);

    const btnBack = page.locator('#btn-close-level-select');
    await expect(btnBack).toBeVisible();
    const backBox = await btnBack.boundingBox();
    expect(backBox!.height).toBeGreaterThanOrEqual(48);

    await page.screenshot({
      path: 'test-results/m6-level-select.png'
    });

    await btnBack.click();
    await expect(levelSelectModal).toBeHidden();
  });

  test('launches game from menu, plays Level 1, and verifies pause button return', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const btnPlay = page.locator('#btn-play');
    await btnPlay.click();

    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).toBeHidden();

    const pauseBtn = page.locator('#btn-pause-menu');
    await expect(pauseBtn).toBeVisible();
    const pauseBox = await pauseBtn.boundingBox();
    expect(pauseBox!.width).toBeGreaterThanOrEqual(48);
    expect(pauseBox!.height).toBeGreaterThanOrEqual(48);

    // Click pause to return to menu
    await pauseBtn.click();
    await expect(mainMenu).toBeVisible();
  });

  test('verifies Victory flow, "NEXT LEVEL" progression, and Level 2 loading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?skipMenu&debug');

    // Trigger level victory via dev hook
    await page.evaluate(() => {
      const win = window as unknown as { __triggerWin?: () => void };
      if (win.__triggerWin) win.__triggerWin();
    });

    await page.waitForTimeout(300);

    const victoryModal = page.locator('#victory-modal');
    await expect(victoryModal).toBeVisible();

    const btnNextLevel = page.locator('#btn-next-level');
    await expect(btnNextLevel).toBeVisible();
    const nextBox = await btnNextLevel.boundingBox();
    expect(nextBox!.height).toBeGreaterThanOrEqual(48);

    // Advance to Level 2
    await btnNextLevel.click();
    await expect(victoryModal).toBeHidden();

    // Check HUD banner reflects Level 2 Canyon Run
    const hudLevelBadge = page.locator('#hud-level-badge');
    await expect(hudLevelBadge).toHaveText('LVL 2');
    const hudLevelTitle = page.locator('#hud-level-title');
    await expect(hudLevelTitle).toHaveText('CANYON RUN');

    await page.waitForTimeout(400);

    await page.screenshot({
      path: 'test-results/m6-level2-gameplay.png'
    });
  });
});
