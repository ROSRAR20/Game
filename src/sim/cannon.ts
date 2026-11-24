import { CONFIG } from '../config/constants';
import { MobPool, spawnMob } from './pool';
import { SeededRNG } from './rng';

export type TierStatOption = 'option1' | 'option2';

export class CannonSim {
  public x: number = 0;
  public targetX: number = 0;
  public fireTimer: number = 0;
  public fireInterval: number = 1 / CONFIG.CANNON_FIRE_RATE;
  public tier: number = 0; // 0 = Standard, 1 = Triple/Armored, 2 = Elite Squad
  public cannonCount: number = 1; // 1 to 6 shooters (Model 1 approved)
  public justFired: boolean = false;
  public tierOption: TierStatOption = 'option1'; // Option 1 approved: Fixed weight 1, multi-projectile spread

  // Stress testing mode support
  public stressTargetCount: number = 0;

  public static getShooterOffsets(count: number): number[] {
    switch (count) {
      case 1:
        return [0.0];
      case 2:
        return [-0.4, 0.4];
      case 3:
        return [-0.5, 0.0, 0.5];
      case 4:
        return [-0.6, -0.2, 0.2, 0.6];
      case 5:
        return [-0.8, -0.4, 0.0, 0.4, 0.8];
      case 6:
        return [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
      default:
        return [0.0];
    }
  }

  constructor() {
    this.reset();
  }

  public setCannonCount(count: number): void {
    this.cannonCount = Math.max(1, Math.min(6, Math.floor(count)));
  }

  public upgradeTier(maxTier: number = 2): boolean {
    if (this.tier < maxTier) {
      this.setTier(this.tier + 1);
      return true;
    }
    return false;
  }

  public setTier(newTier: number): void {
    this.tier = Math.max(0, Math.min(2, newTier));
    this.updateFireInterval();
  }

  public setTierOption(option: TierStatOption): void {
    this.tierOption = option;
    this.updateFireInterval();
  }

  private updateFireInterval(): void {
    // Steady 6.0 volleys/s across all tiers keeps firing rhythm and audio cadence consistent
    this.fireInterval = 1 / CONFIG.CANNON_FIRE_RATE;
  }

  public reset(): void {
    this.x = 0;
    this.targetX = 0;
    this.fireTimer = 0;
    this.tier = 0;
    this.cannonCount = 1;
    this.tierOption = 'option1';
    this.updateFireInterval();
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

  /**
   * Returns the exact AABB bounds of the current multi-shooter cluster
   * used for panel and object collision detection.
   */
  public getClusterBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const offsets = CannonSim.getShooterOffsets(this.cannonCount);
    const minOffset = offsets[0];
    const maxOffset = offsets[offsets.length - 1];
    const halfWidth = 0.75;
    const halfDepth = 0.6;
    return {
      minX: this.x + minOffset - halfWidth,
      maxX: this.x + maxOffset + halfWidth,
      minZ: CONFIG.CANNON_Z - halfDepth,
      maxZ: CONFIG.CANNON_Z + halfDepth
    };
  }

  public update(dt: number, pool: MobPool, rng: SeededRNG): void {
    this.justFired = false;

    // 1. Smoothly interpolate cannon position towards target
    const lerpFactor = Math.min(1, CONFIG.CANNON_LERP_SPEED * dt);
    this.x += (this.targetX - this.x) * lerpFactor;

    // Determine current tier unit properties based on selected candidate option
    let tierHp = 1;
    let tierDamage = 1;
    let tierWeight = 1;

    // Model 1: tier changes shooter type and stats (Tier 0: hp 1, dmg 1; Tier 1: hp 2, dmg 1; Tier 2: hp 2, dmg 2)
    tierHp = this.tier >= 1 ? 2 : 1;
    tierDamage = this.tier === 2 ? 2 : 1;
    tierWeight = 1;

    // 2. Firing logic
    if (this.stressTargetCount > 0) {
      // In stress mode, spawn as rapidly as needed to reach and sustain the target count
      const needed = this.stressTargetCount - pool.count;
      if (needed > 0) {
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
            tierHp,
            tierDamage,
            tierWeight,
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

        if (this.cannonCount === 1 && this.tier === 0) {
          // Bit-identical to M6 baseline: single shot with exact [-0.15, 0.15] RNG jitter
          const jitterX = rng.nextRange(-0.15, 0.15);
          spawnMob(
            pool,
            this.x + jitterX,
            CONFIG.CANNON_MUZZLE_Z,
            0,
            CONFIG.MOB_BASE_SPEED,
            0, // team 0 (Blue)
            0,
            1,
            1,
            1,
            -1 // lastGateId
          );
        } else {
          // Model 1: Exactly 1 shot per shooter in the formation (cannonCount shooters, max 6 shots per volley)
          // Tier changes shooter stats and type, NOT shot count
          const offsets = CannonSim.getShooterOffsets(this.cannonCount);
          for (let i = 0; i < offsets.length; i++) {
            const jitterX = rng.nextRange(-0.06, 0.06);
            spawnMob(
              pool,
              this.x + offsets[i] + jitterX,
              CONFIG.CANNON_MUZZLE_Z,
              0,
              CONFIG.MOB_BASE_SPEED,
              0, // team 0 (Blue)
              this.tier,
              tierHp,
              tierDamage,
              tierWeight,
              -1 // lastGateId
            );
          }
        }
      }
    }
  }
}
