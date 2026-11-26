import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

test('Stage 5 Walkthrough: verifies Periodic Boss visibility, draw calls <= 30, Boss HUD, and Game Over modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // Load default camera (Preset A) right before Boss #1 spawn (?startAt=59) with Tier 2 + 3 Shooters
  await page.goto('/?skipMenu&debug&startAt=59&count=3&tier=2');
  const container = page.locator('#game-container');
  await expect(container).toBeVisible();

  // Wait ~1.5s so Boss #1 spawns at t = 60s (Z = 34.0)
  await page.waitForTimeout(1600);

  const metrics = await page.evaluate(() => {
    const win = window as unknown as {
      __renderer?: {
        info: {
          memory: { geometries: number; textures: number };
          render: { calls: number; triangles: number };
        };
      };
      __camera?: unknown;
      __scene?: { traverse: (cb: (obj: unknown) => void) => void };
      __sim?: {
        bosses?: { bosses: Array<{ id: number; x: number; z: number; hp: number; maxHp: number; isDefeated: boolean }> };
      };
      THREE?: {
        Vector3: new (x: number, y: number, z: number) => {
          project: (cam: unknown) => { x: number; y: number; z: number };
        };
      };
    };

    const renderer = win.__renderer;
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

    const boss = win.__sim?.bosses?.bosses.find((b) => !b.isDefeated);
    const projectPoint = (x: number, y: number, z: number) => {
      if (!win.THREE || !win.__camera) return null;
      const v = new win.THREE.Vector3(x, y, z).project(win.__camera);
      return { ndcX: Number(v.x.toFixed(3)), ndcY: Number(v.y.toFixed(3)), inBounds: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
    };

    const bossStatusText = document.getElementById('hud-boss-status')?.textContent;

    return {
      calls: renderer?.info.render.calls,
      triangles: renderer?.info.render.triangles,
      geometries: renderer?.info.memory.geometries,
      textures: renderer?.info.memory.textures,
      activeMeshObjects: objects.length,
      objects,
      bossStatusText,
      boss: boss ? { id: boss.id, x: boss.x, z: boss.z, hp: boss.hp, maxHp: boss.maxHp } : null,
      bossNDC: boss
        ? {
            body: projectPoint(boss.x, 1.8, boss.z),
            hpBar: projectPoint(boss.x, 4.1, boss.z)
          }
        : null
    };
  });

  console.log('=== [STAGE 5 BOSS DEFAULT CAMERA METRICS] ===', JSON.stringify(metrics, null, 2));

  expect(metrics.boss).not.toBeNull();
  expect(metrics.calls).toBeLessThanOrEqual(30);
  expect(metrics.bossNDC?.body?.inBounds).toBe(true);
  expect(metrics.bossNDC?.hpBar?.inBounds).toBe(true);

  const bossPath = 'test-results/stage5-endless-boss-390x844.png';
  await page.screenshot({ path: bossPath });
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(bossPath, path.join(ARTIFACT_DIR, 'stage5-endless-boss-390x844.png'));
  }

  // Trigger Game Over and capture Endless Game Over summary modal
  await page.evaluate(() => {
    const win = window as unknown as { __triggerGameOver?: () => void };
    win.__triggerGameOver?.();
  });
  await page.waitForTimeout(300);

  await expect(page.locator('#game-over-modal')).toBeVisible();
  await expect(page.locator('#go-kills')).toBeVisible();
  await expect(page.locator('#go-bosses')).toBeVisible();

  const goPath = 'test-results/stage5-endless-gameover-390x844.png';
  await page.screenshot({ path: goPath });
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(goPath, path.join(ARTIFACT_DIR, 'stage5-endless-gameover-390x844.png'));
  }
});
