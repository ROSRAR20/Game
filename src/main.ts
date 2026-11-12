import * as THREE from 'three';
import { ViewportManager } from './render/viewport';
import { createCamera, updateCameraAspect } from './render/camera';
import { createScene } from './render/scene';
import { CannonRender } from './render/cannon';
import { MobRenderer } from './render/mobs';
import { BareStressTest } from './render/bare_stress';
import { Simulation } from './sim/loop';
import { InputManager } from './input/pointer';
import { DebugOverlay } from './ui/debug';

function init(): void {
  const container = document.getElementById('game-container');
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (!container || !canvas) {
    console.error('Missing root game elements');
    return;
  }

  // 1. Viewport & Canvas setup
  const viewport = new ViewportManager(canvas, container);
  const initialSize = viewport.getSize();

  // 2. Renderer setup
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    depth: true,
    stencil: false
  });
  renderer.setPixelRatio(initialSize.dpr);
  renderer.setSize(initialSize.width, initialSize.height, false);

  // 3. Scene & Camera setup
  const { scene } = createScene();
  const camera = createCamera(initialSize);

  // Handle window/container resizing
  viewport.onResize((size) => {
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(size.width, size.height, false);
    updateCameraAspect(camera, size);
  });

  // 4. Debug overlay & stress mode query
  const debug = new DebugOverlay();
  const stressCount = debug.getStressCount();
  const urlParams = new URLSearchParams(window.location.search);
  const useBareStress = urlParams.has('bare');

  // 5. Initialize Simulation & Input
  const sim = new Simulation();
  const input = new InputManager(container, sim.cannon);

  // 6. Visual renderers
  const cannonRender = new CannonRender(scene, sim.cannon);
  const mobRender = new MobRenderer(scene);

  let bareStress: BareStressTest | null = null;

  if (stressCount > 0) {
    if (useBareStress) {
      bareStress = new BareStressTest(scene, stressCount);
      console.info(`[SwarmGate] Bare stress mode active: ${stressCount} cubes`);
    } else {
      sim.setStressMode(stressCount);
      console.info(`[SwarmGate] Gameplay mob stress mode active: ${stressCount} mobs`);
    }
  }

  // 7. Main animation loop
  let lastTime = performance.now();

  function animate(now: number): void {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Update input (keyboard fallback, etc.)
    input.update(dt);

    if (bareStress) {
      bareStress.update(dt);
    } else {
      // Step fixed 60 Hz simulation
      sim.update(dt);

      // Synchronize visual state from sim state
      cannonRender.update();
      mobRender.update(sim.pool);
    }

    renderer.render(scene, camera);

    const activeUnits = bareStress ? bareStress.count : sim.pool.count;
    debug.update(now, activeUnits, renderer, viewport.getSize().dpr);
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', init);
