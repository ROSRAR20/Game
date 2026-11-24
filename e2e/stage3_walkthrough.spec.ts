import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

test('Stage 3 Walkthrough: measures draw calls for count 1 vs count 6 and captures panel + cluster', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const captureScenario = async (
    name: string,
    query: string,
    filename: string,
    waitForPanel: boolean = false
  ) => {
    await page.goto(`/${query}`);
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    if (waitForPanel) {
      // Spawn a panel immediately if needed or wait for spawner
      await page.evaluate(() => {
        const win = window as unknown as {
          __sim?: {
            panels?: { spawnPanel: () => void };
          };
        };
        if (win.__sim?.panels) {
          win.__sim.panels.spawnPanel();
        }
      });
      await page.waitForTimeout(1000);
    } else {
      await page.waitForTimeout(1500);
    }

    const metrics = await page.evaluate(() => {
      const win = window as unknown as {
        __renderer?: {
          info: {
            memory: { geometries: number; textures: number };
            render: { calls: number; triangles: number; lines: number; points: number };
          };
        };
        __sim?: {
          cannon?: { cannonCount: number };
          panels?: { panels: Array<{ x: number; z: number }> };
        };
        __scene?: {
          traverse: (cb: (obj: unknown) => void) => void;
        };
      };
      const renderer = win.__renderer;
      const memory = renderer?.info.memory;
      const render = renderer?.info.render;
      const drawsText = document.getElementById('dbg-draws')?.textContent;
      const fpsText = document.getElementById('dbg-fps')?.textContent;
      const zRangeText = document.getElementById('dbg-zrange')?.textContent;
      const cannonCount = win.__sim?.cannon?.cannonCount;
      const activePanels = win.__sim?.panels?.panels;

      const objects: Array<{ type: string; geom: string; mat: string }> = [];
      win.__scene?.traverse((obj: unknown) => {
        const item = obj as { isMesh?: boolean; isInstancedMesh?: boolean; visible?: boolean; type: string; geometry?: { constructor?: { name?: string } }; material?: { constructor?: { name?: string } } };
        if ((item.isMesh || item.isInstancedMesh) && item.visible !== false) {
          objects.push({
            type: item.type,
            geom: item.geometry?.constructor?.name || 'unknown',
            mat: item.material?.constructor?.name || 'unknown'
          });
        }
      });

      return { memory, render, drawsText, fpsText, zRangeText, cannonCount, activePanels, objects };
    });

    console.log(`=== [${name}] METRICS ===`, JSON.stringify({
      calls: metrics.render?.calls,
      geometries: metrics.memory?.geometries,
      textures: metrics.memory?.textures,
      triangles: metrics.render?.triangles,
      cannonCount: metrics.cannonCount,
      activePanels: metrics.activePanels,
      objectCount: metrics.objects?.length
    }, null, 2));

    const localPath = `test-results/${filename}`;
    await page.screenshot({ path: localPath });
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, filename));
    }
    return metrics;
  };

  // 1. Measure count 1 draw calls
  const m1 = await captureScenario(
    'Count 1 Single Shooter (?count=1)',
    '?skipMenu&debug&camPreset=middle&count=1',
    'stage3-endless-count1-390x844.png'
  );

  // 2. Measure count 6 maximum shooters
  const m6 = await captureScenario(
    'Count 6 Cluster Shooters (?count=6)',
    '?skipMenu&debug&camPreset=middle&count=6',
    'stage3-endless-count6-390x844.png'
  );

  // Assert that 1 to 6 shooters cost the exact same draw calls (InstancedMesh)
  expect(m1.render?.calls).toBe(m6.render?.calls);
  expect(m1.render?.calls).toBeLessThanOrEqual(30);

  // 3. Capture Walkthrough screenshot: cluster of 3 shooters + moving +1 panel in Left Lane
  await captureScenario(
    'Stage 3 Walkthrough: 3 Shooters + Moving Panel (?count=3)',
    '?skipMenu&debug&camPreset=middle&count=3',
    'stage3-endless-panel-cluster-390x844.png',
    true
  );
});
