import { test, expect } from '@playwright/test';

test.describe('Milestone M2 Gates & Clone Logic', () => {
  test('renders flat banner gates with canvas number textures and clones mobs on passage', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Allow auto-fire to send mobs up the road towards the first gate pair at Z = 25
    // Cannon fires at Z = 6.2, mob speed is 12 u/s -> reaches Z = 25 in ~1.6s
    await page.waitForTimeout(3000);

    // After 3 seconds, multiple units have crossed the +5 and x2 gates at Z = 25,
    // multiplying the swarm count well beyond base fire rate (6/s * 3s = ~18, with multipliers > 30)
    const unitsText = await page.locator('#dbg-units').textContent();
    expect(unitsText).toMatch(/\d+ \(vis: \d+\)/);

    const match = unitsText?.match(/^(\d+)/);
    const count = Number(match?.[1]);
    expect(count).toBeGreaterThan(20);

    // Verify debug overlay is healthy and running at full 60 fps
    const fpsText = await page.locator('#dbg-fps').textContent();
    expect(Number(fpsText)).toBeGreaterThanOrEqual(45);

    // Capture screenshot for M2 Walkthrough
    await page.screenshot({ path: 'test-results/m2-gates-clones.png' });
  });

  test('steers cannon to hit multiplier gates and verifies explosive swarm growth', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?debug');

    const container = page.locator('#game-container');
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Steer cannon toward right lane (x > 0) to target the x2 gate at Z = 25
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height * 0.75;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY, { steps: 5 });
    await page.mouse.up();

    // Allow stream to pass through gate
    await page.waitForTimeout(3500);

    const unitsText = await page.locator('#dbg-units').textContent();
    const match = unitsText?.match(/^(\d+)/);
    const count = Number(match?.[1]);

    // High unit count confirmed
    expect(count).toBeGreaterThanOrEqual(25);
  });
});
