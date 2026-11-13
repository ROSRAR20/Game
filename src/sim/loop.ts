import { CONFIG } from '../config/constants';
import { MobPool, createMobPool, despawnMob } from './pool';
import { CannonSim } from './cannon';
import { SeededRNG } from './rng';
import { GateManager } from './gates';
import { getLevelGates } from '../data/level';

export class Simulation {
  public pool: MobPool;
  public cannon: CannonSim;
  public rng: SeededRNG;
  public gates: GateManager;

  private accumulator: number = 0;
  private isStressMode: boolean = false;

  constructor(seed: number = 42, capacity: number = CONFIG.MAX_UNITS) {
    this.pool = createMobPool(capacity);
    this.cannon = new CannonSim();
    this.rng = new SeededRNG(seed);
    this.gates = new GateManager(this.rng);
    this.gates.setGates(getLevelGates());
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

    // 3. Process gate crossings and clone emissions
    if (!this.isStressMode) {
      this.gates.update(this.pool, dt);
    }

    // 4. Handle boundary conditions
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
        // In normal mode, cull units that have run past the top of the road
        if (pool.z[slot] > CONFIG.MOB_MAX_Z) {
          despawnMob(pool, slot);
        }
      }
    }
  }
}
