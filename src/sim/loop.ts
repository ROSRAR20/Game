import { CONFIG } from '../config/constants';
import { MobPool, createMobPool, despawnMob } from './pool';
import { CannonSim } from './cannon';
import { SeededRNG } from './rng';
import { GateManager } from './gates';
import { BaseDefense } from './base';
import { CombatResolver } from './combat';
import { getLevelGates } from '../data/level';

export class Simulation {
  public pool: MobPool;
  public cannon: CannonSim;
  public rng: SeededRNG;
  public gates: GateManager;
  public base: BaseDefense;
  public combat: CombatResolver;

  private readonly initialSeed: number;
  private accumulator: number = 0;
  private isStressMode: boolean = false;

  constructor(seed: number = 42, capacity: number = CONFIG.MAX_UNITS) {
    this.initialSeed = seed;
    this.pool = createMobPool(capacity);
    this.cannon = new CannonSim();
    this.rng = new SeededRNG(seed);
    this.gates = new GateManager(this.rng);
    this.gates.setGates(getLevelGates());
    this.base = new BaseDefense(CONFIG.BASE_MAX_HP);
    this.combat = new CombatResolver();
  }

  public setStressMode(targetCount: number): void {
    this.isStressMode = targetCount > 0;
    this.cannon.stressTargetCount = targetCount;
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
    // If base has fallen, simulation freezes in Game Over state
    if (this.base.isGameOver) {
      return;
    }

    // 1. Update cannon state and auto-spawner
    this.cannon.update(dt, this.pool, this.rng);

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

    // 3. Process gate crossings and clone emissions (Team 0 blue mobs only)
    if (!this.isStressMode) {
      this.gates.update(this.pool, dt);
    }

    // 4. Resolve combat collisions and base breaches (Milestone M3)
    if (!this.isStressMode) {
      this.combat.resolveCombat(this.pool);
      this.combat.checkBaseBreaches(this.pool, this.base);
    }

    // 5. Handle boundary conditions
    for (let i = pool.count - 1; i >= 0; i--) {
      const slot = pool.activeIndices[i];
      if (this.isStressMode) {
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
    // 1. Despawn all active units
    while (this.pool.count > 0) {
      const slot = this.pool.activeIndices[this.pool.count - 1];
      despawnMob(this.pool, slot);
    }

    // 2. Reset cannon position and cooldowns
    this.cannon.x = 0;
    this.cannon.targetX = 0;
    this.cannon.fireTimer = 0;

    // 3. Reset RNG back to initial seed
    this.rng.setSeed(seed);

    // 4. Reset base defense
    this.base.reset();

    // 5. Reset gates
    this.gates.reset();

    // 6. Reset timestep accumulator
    this.accumulator = 0;
  }
}
