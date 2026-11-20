import { CONFIG } from '../config/constants';
import { MobPool, spawnMob } from './pool';
import { SeededRNG } from './rng';

export class CannonSim {
  public x: number = 0;
  public targetX: number = 0;
  public fireTimer: number = 0;
  public fireInterval: number = CONFIG.CANNON_TIER_CONFIG[0].fireInterval;
  public tier: number = 0; // 0 = Single Cannon, 1 = Triple Cannon, 2 = Combat Squad
  public justFired: boolean = false;

  // Stress testing mode support
  public stressTargetCount: number = 0;

  constructor() {
    this.reset();
  }

  public upgradeTier(): boolean {
    if (this.tier < 2) {
      this.tier++;
      this.fireInterval = CONFIG.CANNON_TIER_CONFIG[this.tier].fireInterval;
      return true;
    }
    return false;
  }

  public reset(): void {
    this.x = 0;
    this.targetX = 0;
    this.fireTimer = 0;
    this.tier = 0;
    this.fireInterval = CONFIG.CANNON_TIER_CONFIG[0].fireInterval;
    this.justFired = false;
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
    this.justFired = false;

    // 1. Smoothly interpolate cannon position towards target
    const lerpFactor = Math.min(1, CONFIG.CANNON_LERP_SPEED * dt);
    this.x += (this.targetX - this.x) * lerpFactor;

    const cfg = CONFIG.CANNON_TIER_CONFIG[this.tier];

    // 2. Firing logic
    if (this.stressTargetCount > 0) {
      // In stress mode, spawn as rapidly as needed to reach and sustain the target count
      const needed = this.stressTargetCount - pool.count;
      if (needed > 0) {
        // Spawn batch without object allocations
        const batchSize = Math.min(
          needed,
          Math.max(10, Math.ceil(this.stressTargetCount * dt * 2))
        );
        for (let i = 0; i < batchSize; i++) {
          const spawnX = rng.nextRange(CONFIG.CANNON_MIN_X, CONFIG.CANNON_MAX_X);
          const spawnZ = rng.nextRange(CONFIG.CANNON_MUZZLE_Z, CONFIG.ROAD_LENGTH * 0.8);
          spawnMob(
            pool,
            spawnX,
            spawnZ,
            0,
            CONFIG.MOB_BASE_SPEED + rng.nextRange(-1, 1),
            0, // team 0 (Blue)
            this.tier,
            cfg.hp,
            cfg.damage,
            cfg.weight,
            -1 // lastGateId
          );
        }
      }
    } else {
      // Normal auto-firing cadence
      this.fireTimer += dt;
      while (this.fireTimer >= this.fireInterval) {
        this.fireTimer -= this.fireInterval;
        this.justFired = true;

        if (this.tier === 0) {
          // Exact M6 baseline draw: single unit with jitter [-0.15, 0.15]
          const jitterX = rng.nextRange(-0.15, 0.15);
          spawnMob(
            pool,
            this.x + jitterX,
            CONFIG.CANNON_MUZZLE_Z,
            0,
            CONFIG.MOB_BASE_SPEED,
            0, // team 0 (Blue)
            0,
            cfg.hp,
            cfg.damage,
            cfg.weight,
            -1 // lastGateId
          );
        } else {
          // Clustered or squad volleys
          const count = cfg.offsetsX.length;
          for (let k = 0; k < count; k++) {
            const jitterX = rng.nextRange(-0.04, 0.04);
            const spawnX = Math.max(
              CONFIG.CANNON_MIN_X,
              Math.min(CONFIG.CANNON_MAX_X, this.x + cfg.offsetsX[k] + jitterX)
            );
            spawnMob(
              pool,
              spawnX,
              CONFIG.CANNON_MUZZLE_Z,
              0,
              CONFIG.MOB_BASE_SPEED,
              0, // team 0 (Blue)
              this.tier,
              cfg.hp,
              cfg.damage,
              cfg.weight,
              -1 // lastGateId
            );
          }
        }
      }
    }
  }
}
