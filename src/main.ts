import * as THREE from 'three';
import { CONFIG, getEffectiveCameraConfig } from './config/constants';
import { ViewportManager } from './render/viewport';
import { createCamera, updateCameraAspect } from './render/camera';
import { createScene } from './render/scene';
import { CannonRender } from './render/cannon';
import { MobRenderer } from './render/mobs';
import { GateRenderer } from './render/gates';
import { TowerRenderer } from './render/towers';
import { BossRenderer } from './render/boss';
import { PickupRenderer } from './render/pickups';
import { ParticleVFX, ScreenShake } from './render/vfx';
import { SoundManager } from './audio/sound';
import { HapticsManager, SaveManager, PlatformLifecycle, configureDisplay } from './platform';
import { HudController } from './ui/hud';
import { MenuController } from './ui/menu';
import { FarFieldHorde } from './render/far_field';
import { BareStressTest } from './render/bare_stress';
import { AdaptiveQualityManager } from './render/adaptive';
import { Simulation } from './sim/loop';
import { InputManager } from './input/pointer';
import { DebugOverlay } from './ui/debug';
import { CameraTunerPanel } from './ui/cam_tuner';
import { initRefOverlay } from './ui/ref_overlay';
import { computeFrustumGroundRange } from './render/frustum';
import { getLevelData, LevelData, TOTAL_LEVELS } from './data/level';

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

  // 6. Debug overlay & query params
  const debug = new DebugOverlay();
  const stressCount = debug.getStressCount();
  const urlParams = new URLSearchParams(window.location.search);
  const useBareStress = urlParams.has('bare');
  const scenario = urlParams.get('scenario');
  const skipMenuParam = urlParams.has('skipMenu') || urlParams.has('bare') || !!scenario || stressCount > 0 || urlParams.has('debug');
  const initialLevelParam = parseInt(urlParams.get('level') || '1', 10);
  const tierParam = urlParams.get('tier');
  if (tierParam !== null) {
    const t = parseInt(tierParam, 10);
    if (!isNaN(t) && t >= 0 && t <= 2) {
      sim.cannon.tier = t;
      sim.cannon.fireInterval = CONFIG.CANNON_TIER_CONFIG[t].fireInterval;
    }
  }

  // 7. Visual renderers & Juice systems
  const cannonRender = new CannonRender(scene, sim.cannon);
  const mobRender = new MobRenderer(scene);
  const gateRender = new GateRenderer(scene);
  const towerRender = new TowerRenderer(scene);
  const bossRender = new BossRenderer(scene);
  const pickupRender = new PickupRenderer(scene);
  const vfx = new ParticleVFX(scene);
  const screenShake = new ScreenShake();
  const sound = new SoundManager();

  const camBasePos = camera.position.clone();

  // Initialize reference image overlay (?refOverlay=1)
  initRefOverlay();

  // Initialize live camera tuner panel (?camTune)
  new CameraTunerPanel(camera, camConfig, (updatedCfg) => {
    input.updateProjectionAxis(camera);
    gateRender.updateYaw(updatedCfg.yaw);
    camBasePos.copy(camera.position);
    const range = computeFrustumGroundRange(camera);
    debug.updateGroundRange(range);
  });

  // State transition flags for audio/haptics
  let prevGameOver = false;
  let prevGameWon = false;
  let isInMenu = !skipMenuParam;
  let lastTowerHitSoundTime = 0;

  const applyLevelVisuals = (levelData: LevelData) => {
    gateRender.buildGates(sim.gates.getGates());
    towerRender.buildTowers(sim.towers.towers);
    bossRender.buildBosses(sim.bosses.bosses);
    pickupRender.update(0, sim.pickups.pickups, camera);
    hud.setLevel(levelData);
    hud.reset(sim.base.maxHp);
  };

  // Initialize gameplay HUD
  const hud = new HudController({
    onRestart: () => {
      sim.restart();
      const lvl = getLevelData(sim.currentLevelId);
      applyLevelVisuals(lvl);
      vfx.clear();
      screenShake.reset();
      prevGameOver = false;
      prevGameWon = false;
    },
    onNextLevel: () => {
      const nextId = Math.min(TOTAL_LEVELS, sim.currentLevelId + 1);
      const lvl = sim.loadLevel(nextId);
      applyLevelVisuals(lvl);
      vfx.clear();
      screenShake.reset();
      prevGameOver = false;
      prevGameWon = false;
      SaveManager.save({ currentLevel: nextId });
    },
    onOpenMenu: () => {
      isInMenu = true;
      hud.hideGameOver();
      hud.hideVictory();
      menu.showMainMenu(SaveManager.get(), sim.currentLevelId);
    }
  });

  // Initialize Main Menu & Level Select
  const menu = new MenuController({
    onStartLevel: (levelId: number) => {
      isInMenu = false;
      const lvl = sim.loadLevel(levelId);
      applyLevelVisuals(lvl);
      vfx.clear();
      screenShake.reset();
      prevGameOver = false;
      prevGameWon = false;
      SaveManager.save({ currentLevel: levelId });
    },
    onToggleSound: () => {
      const isMuted = !SaveManager.get().soundMuted;
      sound.setMuted(isMuted);
      SaveManager.save({ soundMuted: isMuted });
      return isMuted;
    }
  });

  // Load persistent save data asynchronously
  SaveManager.load().then((saveData) => {
    sound.setMuted(saveData.soundMuted);
    menu.updateSoundButton(saveData.soundMuted);

    if (!skipMenuParam) {
      const targetLvl = initialLevelParam || saveData.currentLevel || 1;
      if (targetLvl !== sim.currentLevelId) {
        const lvl = sim.loadLevel(targetLvl);
        applyLevelVisuals(lvl);
      }
      menu.showMainMenu(saveData, targetLvl);
    } else {
      menu.hideMainMenu();
      isInMenu = false;
    }
  });

  let bareStress: BareStressTest | null = null;

  if (scenario === 'combat') {
    sim.setCombatStressMode(1000, 1000);
    console.info('[SwarmGate] Combat stress scenario active: 1,000 Blue vs 1,000 Red (2,000 active units)');
  } else if (scenario === 'tier2_2000') {
    sim.cannon.tier = 2;
    sim.cannon.fireInterval = CONFIG.CANNON_TIER_CONFIG[2].fireInterval;
    sim.setStressMode(2000);
    const initialLvl = getLevelData(sim.currentLevelId);
    applyLevelVisuals(initialLvl);
    console.info('[SwarmGate] Tier 2 stress scenario active: Squad with 2,000 active units');
  } else if (stressCount > 0) {
    if (useBareStress) {
      bareStress = new BareStressTest(scene, stressCount);
      console.info(`[SwarmGate] Bare stress mode active: ${stressCount} cubes`);
    } else {
      sim.setStressMode(stressCount);
      console.info(`[SwarmGate] Gameplay mob stress mode active: ${stressCount} mobs`);
    }
  } else {
    const initialLvl = getLevelData(sim.currentLevelId);
    applyLevelVisuals(initialLvl);
  }

  // 8. Platform initialization & lifecycle listeners
  PlatformLifecycle.addListener({
    onPause: () => {
      console.info('[SwarmGate] Simulation paused on app background');
    },
    onResume: () => {
      console.info('[SwarmGate] Simulation resumed on app foreground');
      lastTime = performance.now();
    },
    onBackButton: () => {
      if (!isInMenu) {
        isInMenu = true;
        hud.hideGameOver();
        hud.hideVictory();
        menu.showMainMenu(SaveManager.get(), sim.currentLevelId);
      }
    }
  });

  configureDisplay().catch((err) => {
    console.warn('[SwarmGate] Platform display setup note:', err);
  });

  // Dev hooks for testing
  (window as unknown as {
    __sim?: unknown;
    __scene?: THREE.Scene;
    __renderer?: THREE.WebGLRenderer;
    __triggerGameOver?: () => void;
    __triggerWin?: () => void;
    __spawnBlueMobs?: (count: number, z: number) => void;
    __sound?: SoundManager;
    __vfx?: ParticleVFX;
    __screenShake?: ScreenShake;
    __menu?: MenuController;
    __loadLevel?: (id: number) => void;
    __saveManager?: typeof SaveManager;
  }).__sim = sim;
  (window as unknown as { __scene?: THREE.Scene }).__scene = scene;
  (window as unknown as { __renderer?: THREE.WebGLRenderer }).__renderer = renderer;
  (window as unknown as { __sound?: SoundManager }).__sound = sound;
  (window as unknown as { __vfx?: ParticleVFX }).__vfx = vfx;
  (window as unknown as { __screenShake?: ScreenShake }).__screenShake = screenShake;
  (window as unknown as { __menu?: MenuController }).__menu = menu;
  (window as unknown as { __saveManager?: typeof SaveManager }).__saveManager = SaveManager;
  (window as unknown as { __loadLevel?: (id: number) => void }).__loadLevel = (id: number) => {
    const lvl = sim.loadLevel(id);
    applyLevelVisuals(lvl);
    isInMenu = false;
    menu.hideMainMenu();
  };

  (window as unknown as { __triggerGameOver?: () => void }).__triggerGameOver = () => {
    sim.base.takeDamage(CONFIG.BASE_MAX_HP);
  };

  (window as unknown as { __triggerWin?: () => void }).__triggerWin = () => {
    for (const t of sim.towers.towers) {
      t.hp = 0;
      t.isDestroyed = true;
    }
    for (const b of sim.bosses.bosses) {
      b.hp = 0;
      b.isDefeated = true;
    }
    for (let i = sim.pool.count - 1; i >= 0; i--) {
      const slot = sim.pool.activeIndices[i];
      if (sim.pool.team[slot] === 1) {
        sim.pool.active[slot] = 0;
      }
    }
    sim.waves.currentWaveIdx = sim.waves.waves.length;
    sim.isGameWon = true;
  };

  (window as unknown as { __spawnBlueMobs?: (count: number, z: number) => void }).__spawnBlueMobs = (
    count: number,
    z: number
  ) => {
    for (let i = 0; i < count; i++) {
      sim.spawnMob(
        (Math.random() - 0.5) * 2.0,
        z + (Math.random() - 0.5) * 1.5,
        0,
        8,
        0,
        0,
        1,
        1,
        1
      );
    }
  };

  // 9. Main animation loop
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

    // Update input (only if gameplay is active)
    if (!isInMenu) {
      input.update(dt);
    }

    if (bareStress) {
      bareStress.update(dt);
      cannonRender.update();
    } else if (!isInMenu) {
      // Step fixed 60 Hz simulation during active gameplay
      sim.update(dt);

      // Sim events -> Juice & Haptics & Audio & VFX
      if (sim.cannon.justFired) {
        vfx.spawnMuzzleFlash(sim.cannon.x, 0.35, 0.5);
        if (sim.cannon.tier === 2) {
          vfx.spawnFlameStreaks(sim.cannon.x, CONFIG.CANNON_MUZZLE_Z);
        }
        sound.playShoot();
        HapticsManager.light();
        sim.cannon.justFired = false;
      }

      if (sim.pickups.justCollectedUpgrade) {
        vfx.spawnGateSparkles(sim.cannon.x, 0.6, 24.0, 16, true);
        screenShake.addTrauma(0.25);
        sound.playLevelUp();
        HapticsManager.medium();
        sim.pickups.justCollectedUpgrade = false;
      }

      if (sim.towers.justUpgradedTier) {
        vfx.spawnGateSparkles(sim.cannon.x, 0.6, sim.towers.lastTowerZ, 20, true);
        screenShake.addTrauma(0.25);
        sound.playLevelUp();
        HapticsManager.medium();
        sim.towers.justUpgradedTier = false;
      }

      if (sim.gates.justCrossedGate) {
        vfx.spawnGateSparkles(sim.gates.lastCrossedGateX, 0.4, sim.gates.lastCrossedGateZ, 6);
        sound.playGatePass();
        HapticsManager.medium();
        sim.gates.justCrossedGate = false;
      }

      if (sim.combat.justHadCombatHit) {
        vfx.spawnHitSparks(sim.combat.lastHitX, 0.3, sim.combat.lastHitZ, 3);
        sound.playHit();
        sim.combat.justHadCombatHit = false;
      }

      if (sim.combat.justHadBaseBreach) {
        screenShake.addTrauma(0.35);
        sound.playGameOver();
        HapticsManager.heavy();
        sim.combat.justHadBaseBreach = false;
      }

      if (sim.towers.justDamagedTower) {
        vfx.spawnHitSparks(sim.towers.lastTowerX, 1.0, sim.towers.lastTowerZ, 3);
        const nowSec = performance.now() * 0.001;
        if (nowSec - lastTowerHitSoundTime >= 0.075) {
          sound.playHit();
          screenShake.addTrauma(0.02);
          lastTowerHitSoundTime = nowSec;
        }
        sim.towers.justDamagedTower = false;
      }

      if (sim.towers.justDestroyedTower) {
        vfx.spawnExplosion(sim.towers.lastTowerX, 1.2, sim.towers.lastTowerZ, 32);
        screenShake.addTrauma(0.4);
        sound.playTowerExplosion();
        HapticsManager.heavy();
        sim.towers.justDestroyedTower = false;
      }

      if (sim.bosses.justDamagedBoss) {
        vfx.spawnHitSparks(sim.bosses.lastBossX, 1.2, sim.bosses.lastBossZ, 4);
        sound.playHit();
        sim.bosses.justDamagedBoss = false;
      }

      if (sim.bosses.justDefeatedBoss) {
        vfx.spawnExplosion(sim.bosses.lastBossX, 1.5, sim.bosses.lastBossZ, 40);
        screenShake.addTrauma(0.65);
        sound.playTowerExplosion();
        HapticsManager.heavy();
        sim.bosses.justDefeatedBoss = false;
      }

      if (sim.isGameWon && !prevGameWon) {
        sound.playVictory();
        HapticsManager.success();
        prevGameWon = true;

        // Persist victory and stars
        SaveManager.completeLevel(sim.currentLevelId, sim.base.hp).then((res) => {
          console.info(`[SwarmGate] Level ${sim.currentLevelId} completed with ${res.stars} stars.`);
        });
      }

      if (sim.base.isGameOver && !prevGameOver) {
        sound.playGameOver();
        HapticsManager.heavy();
        prevGameOver = true;
      }

      // Synchronize visual state from sim state
      cannonRender.update();
      mobRender.update(sim.pool);
      towerRender.update(sim.towers.towers);
      bossRender.update(sim.bosses.bosses);
      pickupRender.update(dt, sim.pickups.pickups, camera);
      vfx.update(dt, camera);
      screenShake.update(dt, camera, camBasePos);

      const towersRemaining = sim.towers.getRequiredTowersRemaining();
      const bossesRemaining = sim.bosses.bosses.filter((b) => !b.isDefeated).length;
      hud.update(
        sim.base.hp,
        sim.base.maxHp,
        sim.base.isGameOver,
        sim.isGameWon,
        towersRemaining,
        bossesRemaining
      );
    } else {
      // Idle backdrop rendering in menu
      cannonRender.update();
      mobRender.update(sim.pool);
      towerRender.update(sim.towers.towers);
      bossRender.update(sim.bosses.bosses);
      pickupRender.update(dt, sim.pickups.pickups, camera);
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
