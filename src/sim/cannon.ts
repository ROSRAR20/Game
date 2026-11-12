import { CONFIG } from '../config/constants';
import { MobPool, spawnMob } from './pool';
import { SeededRNG } from './rng';

export class CannonSim {
  public x: number = 0;
  public targetX: number = 0;
  public fireTimer: number = 0;
  public fireInterval: number = 1 / CONFIG.CANNON_FIRE_RATE;

  // Stress testing mode support
  public stressTargetCount: number = 0;

  constructor() {
    this.x = 0;
    this.targetX = 0;
    this.fireTimer = 0;
  }

  public setTargetX(newTargetX: number): void {
    this.targetX = Math.max(
      CONFIG.CANNON_MIN_X,
      Math.min(CONFIG.CANNON_MAX_X, newTargetX)
    );
  }

  public addDeltaX(deltaX: number): void {
    this.setTargetX(this.targetX + deltaX);
  }

  public update(dt: number, pool: MobPool, rng: SeededRNG): void {
    // 1. Smoothly interpolate cannon position towards target
    const lerpFactor = Math.min(1, CONFIG.CANNON_LERP_SPEED * dt);
    this.x += (this.targetX - this.x) * lerpFactor;

    // 2. Firing logic
    if (this.stressTargetCount > 0) {
      // In stress mode, spawn as rapidly as needed to reach and sustain the target count
      const needed = this.stressTargetCount - pool.count;
      if (needed > 0) {
        // Spawn batch without object allocations
        const batchSize = Math.min(needed, Math.max(10, Math.ceil(this.stressTargetCount * dt * 2)));
        for (let i = 0; i < batchSize; i++) {
          const spawnX = rng.nextRange(CONFIG.CANNON_MIN_X, CONFIG.CANNON_MAX_X);
          const spawnZ = rng.nextRange(CONFIG.CANNON_Z, CONFIG.ROAD_LENGTH * 0.8);
          spawnMob(
            pool,
            spawnX,
            spawnZ,
            0,
            CONFIG.MOB_BASE_SPEED + rng.nextRange(-1, 1),
            0, // team 0 (Blue)
            0, // tier
            1, // hp
            1, // damage
            1, // weight
            -1 // lastGateId
          );
        }
      }
    } else {
      // Normal auto-firing cadence
      this.fireTimer += dt;
      while (this.fireTimer >= this.fireInterval) {
        this.fireTimer -= this.fireInterval;

        // Small lateral jitter on bullet/mob spawn for organic cluster feel
        const jitterX = rng.nextRange(-0.15, 0.15);
        spawnMob(
          pool,
          this.x + jitterX,
          CONFIG.CANNON_Z,
          0,
          CONFIG.MOB_BASE_SPEED,
          0, // team 0 (Blue)
          0, // tier
          1, // hp
          1, // damage
          1, // weight
          -1 // lastGateId
        );
      }
    }
  }
}
