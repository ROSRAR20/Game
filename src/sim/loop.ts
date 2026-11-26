import { CONFIG } from '../config/constants';
import { MobPool, createMobPool, despawnMob, spawnMob, resetMobPool } from './pool';
import { CannonSim } from './cannon';
import { SeededRNG } from './rng';
import { GateManager } from './gates';
import { BaseDefense } from './base';
import { CombatResolver } from './combat';
import { WaveManager } from './waves';
import { TowerManager } from './towers';
import { BossManager } from './boss';
import { PickupManager } from './pickups';
import { EndlessManager } from './endless';
import { PanelManager, PanelBonusEvent } from './panels';
import { StatueQueueManager, StatueUpdateResult } from './statues';
import { getLevelGates, getLevelData, LevelData } from '../data/level';

export class Simulation {
  public pool: MobPool;
  public cannon: CannonSim;
  public rng: SeededRNG;
  public gates: GateManager;
  public base: BaseDefense;
  public combat: CombatResolver;
  public waves: WaveManager;
  public towers: TowerManager;
  public bosses: BossManager;
  public pickups: PickupManager;
  public endless: EndlessManager;
  public panels: PanelManager;
  public statues: StatueQueueManager;
  public lastStatueEvent: StatueUpdateResult | null = null;
  public lastPanelBonusEvent: PanelBonusEvent | null = null;
  public isEndless: boolean = false;
  public ticks: number = 0;
  public isGameWon: boolean = false;
  public currentLevelId: number = 1;

  private readonly initialSeed: number;
  private accumulator: number = 0;
  private isStressMode: boolean = false;
  private isCombatStressMode: boolean = false;
  private combatStressTargetBlue: number = 0;
  private combatStressTargetRed: number = 0;

  constructor(seed: number = 42, capacity: number = CONFIG.MAX_UNITS, initialLevel: number = 1) {
    this.initialSeed = seed;
    this.currentLevelId = Math.max(1, Math.min(5, initialLevel));
    this.pool = createMobPool(capacity);
    this.cannon = new CannonSim();
    this.rng = new SeededRNG(seed);
    this.endless = new EndlessManager(seed);
    this.panels = new PanelManager(seed);
    this.statues = new StatueQueueManager();

    const levelData = getLevelData(this.currentLevelId);
    this.gates = new GateManager(this.rng);
    this.gates.setGates(getLevelGates(this.currentLevelId));
    this.base = new BaseDefense(CONFIG.BASE_MAX_HP);
    this.combat = new CombatResolver();
    this.waves = new WaveManager(levelData.waves);
    this.towers = new TowerManager(levelData.towers);
    this.bosses = new BossManager(levelData.bosses);
    this.pickups = new PickupManager(levelData.pickups);
    this.isGameWon = false;
  }

  public startEndless(startAtSeconds: number = 0): void {
    this.isEndless = true;
    this.ticks = Math.floor(startAtSeconds * 60);
    this.endless.reset(startAtSeconds);
    this.panels.reset();
    this.statues.reset();
    this.towers.setTowers([]);
    this.bosses.setBosses([]);
    this.lastStatueEvent = null;
    this.lastPanelBonusEvent = null;
    // In endless mode, only the 2 centre gates (Gate 1 and Gate 2) are active
    const levelGates = getLevelGates(1).filter((g) => g.id === 1 || g.id === 2);
    this.gates.setGates(levelGates);
    this.base.reset();
    this.isGameWon = false;
  }

  public loadLevel(levelId: number): LevelData {
    this.currentLevelId = Math.max(1, Math.min(5, Math.floor(levelId)));
    const levelData = getLevelData(this.currentLevelId);
    this.gates.setGates(getLevelGates(this.currentLevelId));
    this.waves.setWaves(levelData.waves);
    this.towers.setTowers(levelData.towers);
    this.bosses.setBosses(levelData.bosses);
    this.pickups.setPickups(levelData.pickups);
    this.restart();
    return levelData;
  }

  public setStressMode(targetCount: number): void {
    this.isStressMode = targetCount > 0;
    this.cannon.stressTargetCount = targetCount;
  }

  public setCombatStressMode(targetBlue: number = 1000, targetRed: number = 1000): void {
    this.isCombatStressMode = targetBlue > 0 || targetRed > 0;
    this.combatStressTargetBlue = targetBlue;
    this.combatStressTargetRed = targetRed;
    if (this.isCombatStressMode) {
      this.cannon.fireInterval = 999999;
    }
  }

  public getTeamCounts(): { blue: number; red: number } {
    let blue = 0;
    let red = 0;
    const count = this.pool.count;
    const team = this.pool.team;
    const active = this.pool.activeIndices;
    for (let i = 0; i < count; i++) {
      if (team[active[i]] === 0) blue++;
      else red++;
    }
    return { blue, red };
  }

  public spawnMob(
    x: number,
    z: number,
    vx: number,
    vz: number,
    team: number,
    tier: number = 0,
    hp: number = 1,
    damage: number = 1,
    weight: number = 1,
    lastGateId: number = -1
  ): number {
    return spawnMob(this.pool, x, z, vx, vz, team, tier, hp, damage, weight, lastGateId);
  }

  /**
   * Advances simulation with fixed-timestep accumulator (60 Hz).
   * Safe against frame hitch spikes (clamps sub-steps).
   */
  public update(realDeltaTime: number): void {
    const dt = Math.min(realDeltaTime, 0.1);
    this.accumulator += dt;

    let subSteps = 0;
    while (
      this.accumulator >= CONFIG.FIXED_DELTA_TIME &&
      subSteps < CONFIG.MAX_SUB_STEPS
    ) {
      this.step(CONFIG.FIXED_DELTA_TIME);
      this.accumulator -= CONFIG.FIXED_DELTA_TIME;
      subSteps++;
    }

    // Discard residual accumulation if falling behind to avoid spiral of death
    if (this.accumulator >= CONFIG.FIXED_DELTA_TIME) {
      this.accumulator = 0;
    }
  }

  /**
   * Single deterministic tick of the simulation.
   */
  public step(dt: number): void {
    // If base has fallen or level is cleared, simulation freezes
    if (this.base.isGameOver || this.isGameWon) {
      return;
    }

    // 1. Update cannon state and auto-spawner
    this.cannon.update(dt, this.pool, this.rng);

    // Continuous combat stress replenishment (keeps ~targetBlue and ~targetRed in combat)
    if (this.isCombatStressMode) {
      let blueCount = 0;
      let redCount = 0;
      for (let i = 0; i < this.pool.count; i++) {
        const slot = this.pool.activeIndices[i];
        if (this.pool.team[slot] === 0) blueCount++;
        else redCount++;
      }

      const needBlue = this.combatStressTargetBlue - blueCount;
      if (needBlue > 0) {
        const batch = Math.min(needBlue, 50);
        for (let i = 0; i < batch; i++) {
          const sx = this.rng.nextRange(CONFIG.CANNON_MIN_X, CONFIG.CANNON_MAX_X);
          const sz = this.rng.nextRange(CONFIG.CANNON_MUZZLE_Z, 22);
          spawnMob(this.pool, sx, sz, 0, CONFIG.MOB_BASE_SPEED, 0);
        }
      }

      const needRed = this.combatStressTargetRed - redCount;
      if (needRed > 0) {
        const batch = Math.min(needRed, 50);
        for (let i = 0; i < batch; i++) {
          const sx = this.rng.nextRange(
            CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS,
            CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS
          );
          const sz = this.rng.nextRange(30, 52);
          spawnMob(this.pool, sx, sz, 0, -3.0, 1, 0, 1, 1, 1);
        }
      }
    }

    // 2. Step mob positions and handle road boundaries
    const count = this.pool.count;
    const pool = this.pool;

    // Traverse active units backwards so despawns during loop do not shift unprocessed indices
    for (let i = count - 1; i >= 0; i--) {
      const slot = pool.activeIndices[i];

      // Update positions
      pool.x[slot] += pool.vx[slot] * dt;
      pool.z[slot] += pool.vz[slot] * dt;

      // Dampen lateral expansion impulse so swarm stabilizes into forward march
      pool.vx[slot] *= 0.92;

      // Keep units clamped within road fences
      if (pool.x[slot] < CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS) {
        pool.x[slot] = CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS;
        pool.vx[slot] = 0;
      } else if (pool.x[slot] > CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS) {
        pool.x[slot] = CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS;
        pool.vx[slot] = 0;
      }
    }

    // 3. Process gate crossings, wave spawns, towers, bosses, and combat collisions
    if (this.isCombatStressMode) {
      this.combat.resolveCombat(this.pool);
    } else if (this.isStressMode) {
      // Stress mode active
    } else if (this.isEndless) {
      this.ticks++;
      const teamCounts = this.getTeamCounts();
      this.endless.update(dt, this.pool, teamCounts.red);

      // Periodic Boss spawning (Stage 5)
      if (this.endless.difficultyTime >= this.endless.nextBossTimeSec) {
        this.endless.bossSpawnCount++;
        const bossNum = this.endless.bossSpawnCount;
        const bossHp = CONFIG.ENDLESS_BOSS.BASE_HP + (bossNum - 1) * CONFIG.ENDLESS_BOSS.HP_STEP;
        this.endless.nextBossTimeSec += CONFIG.ENDLESS_BOSS.INTERVAL_SEC;

        // Replace defeated boss slots with the new periodic boss (or append if an earlier boss is still alive)
        const activeBosses = this.bosses.bosses.filter((b) => !b.isDefeated);
        const newBossData = {
          id: bossNum,
          x: CONFIG.ENDLESS_BOSS.SPAWN_X,
          z: CONFIG.ENDLESS_BOSS.SPAWN_Z,
          radius: CONFIG.ENDLESS_BOSS.RADIUS,
          maxHp: bossHp,
          damage: CONFIG.ENDLESS_BOSS.BASE_DAMAGE,
          speed: CONFIG.ENDLESS_BOSS.SPEED
        };
        this.bosses.setBosses([
          ...activeBosses.map((b) => ({
            id: b.id,
            x: b.x,
            z: b.z,
            radius: b.radius,
            maxHp: b.maxHp,
            damage: b.damage,
            speed: b.speed
          })),
          newBossData
        ]);
        // Preserve live HP of any still-active earlier boss
        for (let i = 0; i < activeBosses.length; i++) {
          this.bosses.bosses[i].hp = activeBosses[i].hp;
        }
      }

      const panelCollision = this.panels.update(dt, this.endless.difficultyTime, this.cannon);
      if (panelCollision.bonusScoreAwarded > 0) {
        this.endless.addScore(panelCollision.bonusScoreAwarded);
        if (panelCollision.bonusEvent) {
          this.lastPanelBonusEvent = panelCollision.bonusEvent;
        }
      }
      const statueResult = this.statues.update(dt, this.pool, this.cannon);
      if (statueResult.scoreAwarded > 0) {
        this.endless.addScore(statueResult.scoreAwarded);
      }
      if (statueResult.destroyedStatue) {
        this.lastStatueEvent = statueResult;
      }
      this.gates.update(this.pool, dt);
      this.bosses.update(dt, this.pool, this.base);
      if (this.bosses.justDefeatedBoss) {
        this.base.heal(CONFIG.ENDLESS_BOSS.REWARD_HP);
        this.endless.addScore(CONFIG.ENDLESS_BOSS.REWARD_SCORE);
        this.endless.bossesDefeated++;
      }
      const combatStats = this.combat.resolveCombat(this.pool);
      this.endless.kills += combatStats.redKilled;
      this.combat.checkBaseBreaches(this.pool, this.base);
    } else {
      this.gates.update(this.pool, dt);
      this.waves.update(dt, this.pool, this.rng);
      this.pickups.update(this.pool, this.cannon);
      this.towers.update(this.pool, this.rng, this.cannon);
      this.bosses.update(dt, this.pool, this.base);
      this.combat.resolveCombat(this.pool);
      this.combat.checkBaseBreaches(this.pool, this.base);

      // Check win condition (all towers destroyed, all bosses defeated, all waves cleared)
      if (!this.base.isGameOver) {
        const allTowersDestroyed = this.towers.isAllTowersDestroyed();
        const allBossesDefeated = this.bosses.isAllBossesDefeated();
        const allWavesSpawned = this.waves.isAllWavesSpawned();
        const teamCounts = this.getTeamCounts();
        if (allTowersDestroyed && allBossesDefeated && allWavesSpawned && teamCounts.red === 0) {
          this.isGameWon = true;
        }
      }
    }

    // 4. Handle boundary conditions
    for (let i = pool.count - 1; i >= 0; i--) {
      const slot = pool.activeIndices[i];
      if (this.isCombatStressMode) {
        if (pool.team[slot] === 0 && pool.z[slot] > 55) {
          pool.z[slot] = this.rng.nextRange(CONFIG.CANNON_MUZZLE_Z, 18);
          pool.x[slot] = this.rng.nextRange(CONFIG.CANNON_MIN_X, CONFIG.CANNON_MAX_X);
        } else if (pool.team[slot] === 1 && pool.z[slot] < 12) {
          pool.z[slot] = this.rng.nextRange(34, 50);
          pool.x[slot] = this.rng.nextRange(
            CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS,
            CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS
          );
        }
      } else if (this.isStressMode) {
        // In stress mode, wrap units continuously to maintain uniform screen coverage
        const span = CONFIG.ROAD_LENGTH - CONFIG.CANNON_MUZZLE_Z;
        if (pool.z[slot] > CONFIG.ROAD_LENGTH) {
          pool.z[slot] -= span;
          pool.x[slot] = this.rng.nextRange(CONFIG.CANNON_MIN_X, CONFIG.CANNON_MAX_X);
        }
      } else {
        // In normal mode, cull blue units that run past the top of the road
        if (pool.team[slot] === 0 && pool.z[slot] > CONFIG.MOB_MAX_Z) {
          despawnMob(pool, slot);
        }
      }
    }
  }

  /**
   * Resets simulation back to tick 0 state for deterministic restart.
   */
  public restart(seed: number = this.initialSeed): void {
    // 1. Reset pool back to pristine state with ordered free-list
    resetMobPool(this.pool);

    // 2. Reset cannon position, cooldowns, and tier
    this.cannon.reset();

    // 3. Reset RNG back to initial seed
    this.rng.setSeed(seed);

    // 4. Reset base defense
    this.base.reset();

    // 5. Reset gates, waves, towers, bosses, and pickups
    const levelData = getLevelData(this.currentLevelId);
    this.gates.reset();
    this.waves.reset();
    this.towers.reset();
    this.bosses.reset();
    this.pickups.reset(levelData.pickups);
    this.isGameWon = false;

    // 6. Reset timestep accumulator
    this.accumulator = 0;

    if (this.isEndless) {
      this.ticks = 0;
      this.endless.reset();
      this.panels.reset();
      const levelGates = getLevelGates(1).filter((g) => g.id === 1 || g.id === 2);
      this.gates.setGates(levelGates);
    }
  }
}
