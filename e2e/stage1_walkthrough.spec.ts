import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

test('captures Stage 1 390x844 debug screenshot and measures renderer.info', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?skipMenu&debug');

  const container = page.locator('#game-container');
  await expect(container).toBeVisible();
  await page.waitForTimeout(1500);

  // Measure exact renderer.info stats
  const info = await page.evaluate(() => {
    const win = window as unknown as {
      __renderer?: {
        info: {
          memory: { geometries: number; textures: number };
          render: { calls: number; triangles: number; lines: number; points: number };
        };
      };
    };
    const renderer = win.__renderer;
    const memory = renderer?.info.memory;
    const render = renderer?.info.render;
    const drawsText = document.getElementById('dbg-draws')?.textContent;
    const fpsText = document.getElementById('dbg-fps')?.textContent;
    const zRangeText = document.getElementById('dbg-zrange')?.textContent;
    return { memory, render, drawsText, fpsText, zRangeText };
  });

  console.log('=== STAGE 1 RENDERER.INFO LIVE METRICS ===', JSON.stringify(info, null, 2));

  // Take screenshot
  const localPath = 'test-results/stage1-debug-390x844.png';
  await page.screenshot({ path: localPath });

  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, 'stage1-debug-390x844.png'));
  }
});
