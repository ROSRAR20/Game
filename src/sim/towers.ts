import { CONFIG } from '../config/constants';
import { MobPool, despawnMob, spawnMob } from './pool';
import { SeededRNG } from './rng';
import { CannonSim } from './cannon';

export interface TowerData {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly maxHp: number;
  readonly rewardType: 'burst_units' | 'multiplier_burst' | 'upgrade';
  readonly rewardValue: number;
}

export class TowerSim {
  public readonly id: number;
  public readonly x: number;
  public readonly z: number;
  public readonly radius: number;
  public readonly maxHp: number;
  public hp: number;
  public readonly rewardType: 'burst_units' | 'multiplier_burst' | 'upgrade';
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
    for (let i = 0; i < this.towers.length; i++) {
      this.towers[i].reset();
    }
  }

  public isAllTowersDestroyed(): boolean {
    for (let i = 0; i < this.towers.length; i++) {
      // Only count mandatory objective towers, not optional crates or statues
      if (this.towers[i].rewardType === 'upgrade') continue;
      if (!this.towers[i].isDestroyed) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolves blue mob collisions with active towers.
   * Decrements tower HP by mob weight, despawns attacking blue mobs,
   * and triggers reward payouts upon tower destruction.
   * Zero heap allocations during frame tick.
   */
  public update(pool: MobPool, rng: SeededRNG, cannon?: CannonSim): void {
    this.justDestroyedTower = false;
    this.justDamagedTower = false;
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

        // Only player blue units (team 0) attack guardian towers
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
            this.grantReward(tower, pool, rng, cannon);
            break; // Tower destroyed; stop checking further mobs for this tower
          }
        }
      }
    }
  }

  private grantReward(
    tower: TowerSim,
    pool: MobPool,
    rng: SeededRNG,
    cannon?: CannonSim
  ): void {
    if (tower.rewardType === 'upgrade') {
      if (tower.rewardValue === 1) {
        // Crate: +1 cannon tier, capped at Tier 1. Fallback: 25 units
        if (cannon && cannon.tier < 1) {
          cannon.upgradeTier();
        } else {
          this.spawnBurst(tower, pool, rng, 25);
        }
      } else if (tower.rewardValue === 2) {
        // Statue: sets Tier 2 directly. Fallback: 50 units
        if (cannon && cannon.tier < 2) {
          cannon.setTier(2);
        } else {
          this.spawnBurst(tower, pool, rng, 50);
        }
      }
    } else if (tower.rewardType === 'burst_units') {
      this.spawnBurst(tower, pool, rng, tower.rewardValue);
    }
  }

  private spawnBurst(
    tower: TowerSim,
    pool: MobPool,
    rng: SeededRNG,
    burstCount: number
  ): void {
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
