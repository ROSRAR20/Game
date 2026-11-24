import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

test('Stage 2 Endless Scene: measures renderer.info and captures camera options', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const captureScenario = async (
    name: string,
    query: string,
    filename: string
  ) => {
    await page.goto(`/${query}`);
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();
    await page.waitForTimeout(1500);

    const metrics = await page.evaluate(() => {
      const win = window as unknown as {
        __renderer?: {
          info: {
            memory: { geometries: number; textures: number };
            render: { calls: number; triangles: number; lines: number; points: number };
          };
        };
        __scene?: {
          traverse: (cb: (obj: { type: string; isMesh?: boolean; isInstancedMesh?: boolean; name?: string; visible?: boolean }) => void) => void;
        };
      };
      const renderer = win.__renderer;
      const memory = renderer?.info.memory;
      const render = renderer?.info.render;
      const drawsText = document.getElementById('dbg-draws')?.textContent;
      const fpsText = document.getElementById('dbg-fps')?.textContent;
      const zRangeText = document.getElementById('dbg-zrange')?.textContent;

      const meshList: Array<{ type: string; geom: string; mat: string; doubleSided: boolean }> = [];
      win.__scene?.traverse((obj: unknown) => {
        const item = obj as { isMesh?: boolean; isInstancedMesh?: boolean; visible?: boolean; type: string; geometry?: { type?: string }; material?: { type?: string; side?: number } };
        if ((item.isMesh || item.isInstancedMesh) && item.visible !== false) {
          meshList.push({
            type: item.type,
            geom: item.geometry?.type || 'unknown',
            mat: item.material?.type || 'unknown',
            doubleSided: item.material?.side === 2
          });
        }
      });

      return { memory, render, drawsText, fpsText, zRangeText, meshList };
    });

    console.log(`=== [${name}] METRICS ===`, JSON.stringify(metrics, null, 2));

    const localPath = `test-results/${filename}`;
    await page.screenshot({ path: localPath });
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, filename));
    }
    return metrics;
  };

  // 1. Real Endless Scene with Current Camera (Default)
  const defaultMetrics = await captureScenario(
    'Endless Scene (Current Camera)',
    '?skipMenu&debug',
    'stage2-endless-current-390x844.png'
  );

  // Assert draw calls on real endless scene are 30 or fewer (Amendment 6)
  const measuredDraws = defaultMetrics.render?.calls || parseInt(defaultMetrics.drawsText || '0', 10);
  expect(measuredDraws).toBeLessThanOrEqual(30);

  // 2. Endless Scene with Middle Option (Candidate New Default)
  await captureScenario(
    'Endless Scene (Middle Camera Preset)',
    '?skipMenu&debug&camPreset=middle',
    'stage2-endless-middle-390x844.png'
  );

  // 3. Endless Scene with Option B (yaw 10)
  await captureScenario(
    'Endless Scene (Option B Camera Preset)',
    '?skipMenu&debug&camPreset=b',
    'stage2-endless-option-b-390x844.png'
  );

  // 4. Minute 10 Load Stress Scenario (?startAt=600&count=6)
  await captureScenario(
    'Minute 10 Heavy Load (?startAt=600&count=6)',
    '?skipMenu&debug&startAt=600&count=6',
    'stage2-endless-startat600-count6.png'
  );
});
