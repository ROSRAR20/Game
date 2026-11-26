import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

function saveScreenshot(localPath: string, name: string): void {
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, name));
  }
}

test('Stage 6 Walkthrough: captures overhauled Menu, Tier 9 + Max-Cap Popup HUD, Pause Modal, Game Over, and draw calls <= 30', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. Capture Main Menu
  await page.goto('/');
  await expect(page.locator('#main-menu')).toBeVisible();
  await page.waitForTimeout(400);
  const menuPath = 'test-results/stage6-menu-390x844.png';
  await page.screenshot({ path: menuPath });
  saveScreenshot(menuPath, 'stage6-menu-390x844.png');

  // 2. Load Default Camera (Preset A) with Count 6, Tier 9, Overdrive & Max-Cap "+1" Popup
  await page.goto('/?skipMenu&debug&count=6&tier=9');
  await expect(page.locator('#game-container')).toBeVisible();

  await page.evaluate(() => {
    const win = window as unknown as {
      __sim?: {
        cannon?: { activateOverdrive: () => void; x: number; targetX: number };
        panels?: { spawnPanel: () => { x: number; z: number } };
      };
    };
    win.__sim?.cannon?.activateOverdrive();
    if (win.__sim?.cannon && win.__sim?.panels) {
      // Spawn a panel right at the cannon line and steer cannon to trigger MAX! +250 popup
      win.__sim.cannon.x = 4.0;
      win.__sim.cannon.targetX = 4.0;
      const p = win.__sim.panels.spawnPanel();
      p.x = 4.0;
      p.z = 5.2;
    }
  });

  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const win = window as unknown as {
      __renderer?: {
        info: {
          memory: { geometries: number; textures: number };
          render: { calls: number; triangles: number };
        };
      };
      __scene?: { traverse: (cb: (obj: unknown) => void) => void };
    };
    const objects: Array<{ type: string; geom: string; mat: string }> = [];
    win.__scene?.traverse((obj: unknown) => {
      const item = obj as {
        isMesh?: boolean;
        isInstancedMesh?: boolean;
        visible?: boolean;
        count?: number;
        type: string;
        geometry?: { constructor?: { name?: string } };
        material?: { constructor?: { name?: string } };
      };
      if ((item.isMesh || item.isInstancedMesh) && item.visible !== false) {
        if (item.isInstancedMesh && item.count === 0) return;
        objects.push({
          type: item.type,
          geom: item.geometry?.constructor?.name || 'unknown',
          mat: item.material?.constructor?.name || 'unknown'
        });
      }
    });

    const popupVisible = document.getElementById('panel-max-popup')?.classList.contains('show');
    const tierText = document.getElementById('hud-cannon-tier')?.textContent;

    return {
      calls: win.__renderer?.info.render.calls,
      triangles: win.__renderer?.info.render.triangles,
      geometries: win.__renderer?.info.memory.geometries,
      textures: win.__renderer?.info.memory.textures,
      activeMeshObjects: objects.length,
      objects,
      popupVisible,
      tierText
    };
  });

  console.log('=== [STAGE 6 DEFAULT CAMERA METRICS] ===', JSON.stringify(metrics, null, 2));

  expect(metrics.calls).toBeLessThanOrEqual(30);
  expect(metrics.popupVisible).toBe(true);
  expect(metrics.tierText).toBe('TIER 9 / 9');

  const hudPath = 'test-results/stage6-hud-tier9-390x844.png';
  await page.screenshot({ path: hudPath });
  saveScreenshot(hudPath, 'stage6-hud-tier9-390x844.png');

  // 3. Open Pause Modal & Capture
  await page.click('#btn-pause-menu');
  await expect(page.locator('#pause-modal')).toBeVisible();
  await page.waitForTimeout(200);
  const pausePath = 'test-results/stage6-pause-390x844.png';
  await page.screenshot({ path: pausePath });
  saveScreenshot(pausePath, 'stage6-pause-390x844.png');

  // Resume, trigger Game Over & Capture
  await page.click('#btn-resume');
  await expect(page.locator('#pause-modal')).toBeHidden();
  await page.evaluate(() => {
    const win = window as unknown as { __triggerGameOver?: () => void };
    win.__triggerGameOver?.();
  });
  await expect(page.locator('#game-over-modal')).toBeVisible();
  await page.waitForTimeout(200);
  const goPath = 'test-results/stage6-gameover-390x844.png';
  await page.screenshot({ path: goPath });
  saveScreenshot(goPath, 'stage6-gameover-390x844.png');
});
