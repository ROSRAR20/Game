import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/rosra/.gemini/antigravity/brain/bf2b702b-98a4-4063-a910-84f8645d0e2b';

test('captures 390x844 screenshots and metrics for current camera and 2 camera options', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const runCameraCapture = async (
    name: string,
    urlParams: string,
    outFilename: string
  ) => {
    await page.goto(`/?skipMenu&debug&debugLanes&${urlParams}`);
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();
    await page.waitForTimeout(1000);

    const metrics = await page.evaluate(() => {
      const draws = document.getElementById('dbg-draws')?.textContent;
      const fps = document.getElementById('dbg-fps')?.textContent;
      const zRange = document.getElementById('dbg-zrange')?.textContent;
      return { draws, fps, zRange };
    });

    console.log(`--- [${name}] LIVE METRICS ---`, metrics);

    const localPath = `test-results/${outFilename}`;
    await page.screenshot({ path: localPath });

    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, outFilename));
    }
  };

  // 1. Current camera with L/C/R markers
  await runCameraCapture('Current M6 Camera', '', 'debug-lanes-390x844.png');

  // 2. Camera Option A: Symmetric Corridor (yaw 0, X 0)
  await runCameraCapture(
    'Camera Option A: Symmetric Corridor',
    'camX=0&camYaw=0&camPitch=42&camHeight=22&camFov=56&camLookAtDistance=16.5&camZ=-9',
    'camera-option-a-390x844.png'
  );

  // 3. Camera Option B: Balanced Diagonal (yaw 10, X -3.5)
  await runCameraCapture(
    'Camera Option B: Balanced Diagonal',
    'camX=-3.5&camYaw=10&camPitch=44&camHeight=23&camFov=54&camLookAtDistance=18&camZ=-10',
    'camera-option-b-390x844.png'
  );
});
