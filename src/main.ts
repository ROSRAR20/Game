import * as THREE from 'three';
import { CONFIG, getEffectiveCameraConfig } from './config/constants';
import { ViewportManager } from './render/viewport';
import { createCamera, updateCameraAspect } from './render/camera';
import { createScene } from './render/scene';
import { CannonRender } from './render/cannon';
import { MobRenderer } from './render/mobs';
import { GateRenderer } from './render/gates';
import { HudController } from './ui/hud';
import { FarFieldHorde } from './render/far_field';
import { BareStressTest } from './render/bare_stress';
import { AdaptiveQualityManager } from './render/adaptive';
import { Simulation } from './sim/loop';
import { InputManager } from './input/pointer';
import { DebugOverlay } from './ui/debug';
import { CameraTunerPanel } from './ui/cam_tuner';
import { initRefOverlay } from './ui/ref_overlay';
import { computeFrustumGroundRange } from './render/frustum';
import { PlatformLifecycle, configureDisplay } from './platform';

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

  // 2. Renderer setup (set sand color as WebGL clear color)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    depth: true,
    stencil: false,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(initialSize.dpr);
  renderer.setSize(initialSize.width, initialSize.height, false);
  renderer.setClearColor(CONFIG.COLORS.SAND, 1.0);

  // 3. Scene & Camera setup
  const { scene } = createScene();
  const camConfig = getEffectiveCameraConfig();
  const camera = createCamera(initialSize, camConfig);

  // 4. Far-field horde carpet (flat opaque quad continuation of road)
  new FarFieldHorde(scene);

  // 5. Initialize Simulation & Input
  const sim = new Simulation();
  const input = new InputManager(container, sim.cannon, camera);
  const adaptive = new AdaptiveQualityManager(viewport);

  // Handle window/container resizing
  viewport.onResize((size) => {
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(size.width, size.height, false);
    updateCameraAspect(camera, size);
    input.updateProjectionAxis(camera);
  });

  // 6. Debug overlay & stress mode query
  const debug = new DebugOverlay();
  const stressCount = debug.getStressCount();
  const urlParams = new URLSearchParams(window.location.search);
  const useBareStress = urlParams.has('bare');

  // 7. Visual renderers
  const cannonRender = new CannonRender(scene, sim.cannon);
  const mobRender = new MobRenderer(scene);
  const gateRender = new GateRenderer(scene);

  // Initialize reference image overlay (?refOverlay=1)
  initRefOverlay();

  // Initialize live camera tuner panel (?camTune)
  new CameraTunerPanel(camera, camConfig, (updatedCfg) => {
    input.updateProjectionAxis(camera);
    gateRender.updateYaw(updatedCfg.yaw);
    const range = computeFrustumGroundRange(camera);
    debug.updateGroundRange(range);
  });

  // Initialize gameplay HUD (Base HP bar, Game Over modal, restart trigger)
  const hud = new HudController(() => {
    sim.restart();
    hud.reset();
  });

  let bareStress: BareStressTest | null = null;
  const scenario = urlParams.get('scenario');

  if (scenario === 'combat') {
    sim.setCombatStressMode(1000, 1000);
    console.info('[SwarmGate] Combat stress scenario active: 1,000 Blue vs 1,000 Red (2,000 active units)');
  } else if (stressCount > 0) {
    if (useBareStress) {
      bareStress = new BareStressTest(scene, stressCount);
      console.info(`[SwarmGate] Bare stress mode active: ${stressCount} cubes`);
    } else {
      sim.setStressMode(stressCount);
      console.info(`[SwarmGate] Gameplay mob stress mode active: ${stressCount} mobs`);
    }
  } else {
    // Build level gate banners on the track (aligned with road cross-section)
    gateRender.buildGates(sim.gates.getGates());
  }

  // 7. Platform initialization & lifecycle listeners
  PlatformLifecycle.addListener({
    onPause: () => {
      console.info('[SwarmGate] Simulation paused on app background');
    },
    onResume: () => {
      console.info('[SwarmGate] Simulation resumed on app foreground');
      lastTime = performance.now();
    }
  });

  configureDisplay().catch((err) => {
    console.warn('[SwarmGate] Platform display setup note:', err);
  });

  // Dev hooks for testing
  (window as unknown as { __sim?: unknown; __triggerGameOver?: () => void }).__sim = sim;
  (window as unknown as { __triggerGameOver?: () => void }).__triggerGameOver = () => {
    sim.base.takeDamage(CONFIG.BASE_MAX_HP);
  };

  // 8. Main animation loop
  let lastTime = performance.now();

  function animate(now: number): void {
    requestAnimationFrame(animate);

    if (PlatformLifecycle.getIsPaused()) {
      return;
    }

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Adaptive quality monitoring
    adaptive.update(dt * 1000);

    // Update input (keyboard fallback, etc.)
    input.update(dt);

    if (bareStress) {
      bareStress.update(dt);
      cannonRender.update();
    } else {
      // Step fixed 60 Hz simulation
      sim.update(dt);

      // Synchronize visual state from sim state
      cannonRender.update();
      mobRender.update(sim.pool);
      hud.update(sim.base.hp, sim.base.maxHp, sim.base.isGameOver);
    }

    renderer.render(scene, camera);

    const activeUnits = bareStress ? bareStress.count : sim.pool.count;
    const getVisible = () =>
      bareStress ? bareStress.count : mobRender.countVisibleUnits(camera, sim.pool);

    const groundRange = computeFrustumGroundRange(camera);
    const teamCounts = sim.getTeamCounts();
    debug.update(
      now,
      activeUnits,
      getVisible,
      renderer,
      viewport.getSize().dpr,
      groundRange,
      teamCounts.blue,
      teamCounts.red,
      sim.base.hp
    );
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', init);
