import { CONFIG } from '../config/constants';
import { MobPool, despawnMob, spawnMob } from './pool';
import { SeededRNG } from './rng';
import { CannonSim } from './cannon';

export type TowerRewardType = 'burst_units' | 'multiplier_burst' | 'upgrade';

export interface TowerData {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly maxHp: number;
  readonly rewardType: TowerRewardType;
  readonly rewardValue: number;
}

export class TowerSim {
  public readonly id: number;
  public readonly x: number;
  public readonly z: number;
  public readonly radius: number;
  public readonly maxHp: number;
  public hp: number;
  public readonly rewardType: TowerRewardType;
  public readonly rewardValue: number;
  public isDestroyed: boolean = false;

  constructor(data: TowerData) {
    this.id = data.id;
    this.x = data.x;
    this.z = data.z;
    this.radius = data.radius;
    this.maxHp = data.maxHp;
    this.hp = data.maxHp;
    this.rewardType = data.rewardType;
    this.rewardValue = data.rewardValue;
    this.isDestroyed = false;
  }

  public reset(): void {
    this.hp = this.maxHp;
    this.isDestroyed = false;
  }
}

export class TowerManager {
  public towers: TowerSim[] = [];
  public justDestroyedTower = false;
  public justDamagedTower = false;
  public justUpgradedTier = false;
  public lastTowerX = 0;
  public lastTowerZ = 0;

  constructor(towersData: TowerData[] = []) {
    this.setTowers(towersData);
  }

  public setTowers(towersData: TowerData[]): void {
    this.towers = towersData.map((d) => new TowerSim(d));
  }

  public reset(): void {
    this.justDestroyedTower = false;
    this.justDamagedTower = false;
    this.justUpgradedTier = false;
    for (let i = 0; i < this.towers.length; i++) {
      this.towers[i].reset();
    }
  }

  /**
   * Returns true if all required objectives (excluding optional crates) are destroyed.
   */
  public isAllTowersDestroyed(): boolean {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (t.rewardType === 'upgrade') continue; // Optional crate
      if (!t.isDestroyed) {
        return false;
      }
    }
    return true;
  }

  public getRequiredTowersRemaining(): number {
    return this.towers.filter((t) => !t.isDestroyed && t.rewardType !== 'upgrade').length;
  }

  public hasRequiredTowers(): boolean {
    return this.towers.some((t) => t.rewardType !== 'upgrade');
  }

  /**
   * Resolves blue mob collisions with active towers/crates.
   * Decrements tower HP by mob weight, despawns attacking blue mobs,
   * and triggers reward payouts or tier upgrades upon destruction.
   * Zero heap allocations during frame tick.
   */
  public update(pool: MobPool, rng: SeededRNG, cannon?: CannonSim): void {
    this.justDestroyedTower = false;
    this.justDamagedTower = false;
    this.justUpgradedTier = false;
    if (this.towers.length === 0 || pool.count === 0) return;

    for (let t = 0; t < this.towers.length; t++) {
      const tower = this.towers[t];
      if (tower.isDestroyed) continue;

      const tx = tower.x;
      const tz = tower.z;
      const hitRadius = tower.radius + CONFIG.MOB_RADIUS;
      const hitRadiusSq = hitRadius * hitRadius;

      // Iterate active mobs backwards so despawnMob swap-and-pop is safe
      for (let i = pool.count - 1; i >= 0; i--) {
        const slot = pool.activeIndices[i];

        // Only player blue units (team 0) attack guardian towers & crates
        if (pool.team[slot] !== 0) continue;

        // Quick AABB check
        const dz = pool.z[slot] - tz;
        if (Math.abs(dz) > hitRadius) continue;

        const dx = pool.x[slot] - tx;
        if (Math.abs(dx) > hitRadius) continue;

        const distSq = dx * dx + dz * dz;
        if (distSq <= hitRadiusSq) {
          const dmg = pool.weight[slot];
          tower.hp -= dmg;
          this.justDamagedTower = true;
          this.lastTowerX = tx;
          this.lastTowerZ = tz;
          despawnMob(pool, slot);

          if (tower.hp <= 0) {
            tower.hp = 0;
            tower.isDestroyed = true;
            this.justDestroyedTower = true;

            if (tower.rewardType === 'upgrade') {
              if (cannon) {
                const upgraded = cannon.upgradeTier();
                if (upgraded) {
                  this.justUpgradedTier = true;
                } else {
                  // Fallback at max tier (Tier 2): burst of rewardValue units (default 25)
                  this.grantReward(tower, pool, rng);
                }
              }
            } else {
              this.grantReward(tower, pool, rng);
            }
            break; // Tower destroyed; stop checking further mobs for this tower
          }
        }
      }
    }
  }

  private grantReward(tower: TowerSim, pool: MobPool, rng: SeededRNG): void {
    if (tower.rewardType === 'burst_units' || tower.rewardType === 'upgrade') {
      const burstCount = tower.rewardValue;
      for (let i = 0; i < burstCount; i++) {
        // Radial dispersion burst moving forward
        const angle = rng.nextRange(-Math.PI * 0.4, Math.PI * 0.4);
        const speed = rng.nextRange(8, 14);
        const vx = Math.sin(angle) * speed * 0.5;
        const vz = Math.cos(angle) * speed;

        const spawnX = Math.max(
          CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS,
          Math.min(CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS, tower.x + rng.nextRange(-0.8, 0.8))
        );
        const spawnZ = tower.z + rng.nextRange(0.2, 1.5);

        spawnMob(pool, spawnX, spawnZ, vx, vz, 0, 0, 1, 1, 1);
      }
    }
  }
}
