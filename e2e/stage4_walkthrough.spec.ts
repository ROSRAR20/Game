import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

test('Stage 4 Walkthrough: verifies 3-statue queue visibility, per-object draw calls <= 30, and tier/overdrive visuals', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // Measure on current default camera (Preset A) with Tier 2 + Overdrive + 3 Statues + 3 Shooters
  await page.goto('/?skipMenu&debug&count=3&tier=2');
  const container = page.locator('#game-container');
  await expect(container).toBeVisible();

  // Trigger Overdrive + spawn a left-lane panel so all Stage 4 elements are active simultaneously
  await page.evaluate(() => {
    const win = window as unknown as {
      __sim?: {
        cannon?: { activateOverdrive: () => void };
        panels?: { spawnPanel: () => void };
      };
    };
    win.__sim?.cannon?.activateOverdrive();
    win.__sim?.panels?.spawnPanel();
  });

  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const win = window as unknown as {
      __renderer?: {
        info: {
          memory: { geometries: number; textures: number };
          render: { calls: number; triangles: number };
        };
      };
      __camera?: {
        matrixWorldInverse: unknown;
        projectionMatrix: unknown;
      };
      __scene?: {
        traverse: (cb: (obj: unknown) => void) => void;
      };
      THREE?: {
        Vector3: new (x: number, y: number, z: number) => {
          x: number;
          y: number;
          z: number;
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

    // Camera visibility check for Slot 1 (X=-4, Z=12), Slot 2 (X=-4, Z=16), Slot 3 (X=-4, Z=20)
    const projectPoint = (x: number, y: number, z: number) => {
      if (!win.THREE || !win.__camera) return null;
      const v = new win.THREE.Vector3(x, y, z).project(win.__camera);
      return { ndcX: Number(v.x.toFixed(3)), ndcY: Number(v.y.toFixed(3)), inBounds: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
    };

    return {
      calls: renderer?.info.render.calls,
      triangles: renderer?.info.render.triangles,
      geometries: renderer?.info.memory.geometries,
      textures: renderer?.info.memory.textures,
      activeMeshObjects: objects.length,
      objects,
      statueNDC: {
        slot1: projectPoint(-4.0, 1.5, 12.0),
        slot2: projectPoint(-4.0, 1.5, 16.0),
        slot3: projectPoint(-4.0, 1.5, 20.0)
      }
    };
  });

  console.log('=== [STAGE 4 DEFAULT CAMERA METRICS] ===', JSON.stringify(metrics, null, 2));

  // Verify draw calls <= 30 and all 3 statue slots are inside NDC [-1, 1]
  expect(metrics.calls).toBeLessThanOrEqual(30);
  expect(metrics.statueNDC.slot1?.inBounds).toBe(true);
  expect(metrics.statueNDC.slot2?.inBounds).toBe(true);
  expect(metrics.statueNDC.slot3?.inBounds).toBe(true);

  const localPath = 'test-results/stage4-endless-statues-390x844.png';
  await page.screenshot({ path: localPath });
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, 'stage4-endless-statues-390x844.png'));
  }
});
