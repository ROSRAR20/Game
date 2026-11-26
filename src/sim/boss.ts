import { CONFIG } from '../config/constants';
import { MobPool, despawnMob } from './pool';
import { BaseDefense } from './base';

export interface BossData {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly speed: number;
}

export class BossSim {
  public readonly id: number;
  public x: number;
  public z: number;
  public readonly initialX: number;
  public readonly initialZ: number;
  public readonly radius: number;
  public readonly maxHp: number;
  public hp: number;
  public readonly damage: number;
  public readonly speed: number;
  public isDefeated: boolean = false;

  constructor(data: BossData) {
    this.id = data.id;
    this.x = data.x;
    this.z = data.z;
    this.initialX = data.x;
    this.initialZ = data.z;
    this.radius = data.radius;
    this.maxHp = data.maxHp;
    this.hp = data.maxHp;
    this.damage = data.damage;
    this.speed = data.speed;
    this.isDefeated = false;
  }

  public reset(): void {
    this.x = this.initialX;
    this.z = this.initialZ;
    this.hp = this.maxHp;
    this.isDefeated = false;
  }
}

export class BossManager {
  public bosses: BossSim[] = [];
  public justDefeatedBoss = false;
  public justDamagedBoss = false;
  public lastBossX = 0;
  public lastBossZ = 0;

  constructor(bossesData: BossData[] = []) {
    this.setBosses(bossesData);
  }

  public setBosses(bossesData: BossData[]): void {
    this.bosses = bossesData.map((d) => new BossSim(d));
  }

  public reset(): void {
    this.justDefeatedBoss = false;
    this.justDamagedBoss = false;
    for (let i = 0; i < this.bosses.length; i++) {
      this.bosses[i].reset();
    }
  }

  public isAllBossesDefeated(): boolean {
    for (let i = 0; i < this.bosses.length; i++) {
      if (!this.bosses[i].isDefeated) {
        return false;
      }
    }
    return true;
  }

  /**
   * Advances boss position along -Z towards the player's base,
   * resolves player swarm collisions, and checks base line breaches.
   */
  public update(dt: number, pool: MobPool, baseDefense: BaseDefense): void {
    this.justDefeatedBoss = false;
    this.justDamagedBoss = false;
    if (this.bosses.length === 0 || baseDefense.isGameOver) return;

    for (let b = 0; b < this.bosses.length; b++) {
      const boss = this.bosses[b];
      if (boss.isDefeated) continue;

      // 1. Advance boss forward toward base line
      boss.z -= boss.speed * dt;

      // 2. Check base breach
      if (boss.z <= CONFIG.BASE_Z) {
        baseDefense.takeDamage(boss.damage);
        boss.isDefeated = true;
        continue;
      }

      // 3. Resolve collisions with blue player units
      if (pool.count === 0) continue;

      const bx = boss.x;
      const bz = boss.z;
      const hitRadius = boss.radius + CONFIG.MOB_RADIUS;
      const hitRadiusSq = hitRadius * hitRadius;

      // Iterate active mobs backwards so despawnMob swap-and-pop is safe
      for (let i = pool.count - 1; i >= 0; i--) {
        const slot = pool.activeIndices[i];

        // Only player blue units (team 0) attack the boss
        if (pool.team[slot] !== 0) continue;

        // Quick AABB test
        const dz = pool.z[slot] - bz;
        if (Math.abs(dz) > hitRadius) continue;

        const dx = pool.x[slot] - bx;
        if (Math.abs(dx) > hitRadius) continue;

        const distSq = dx * dx + dz * dz;
        if (distSq <= hitRadiusSq) {
          const dmg = pool.damage[slot] * pool.weight[slot];
          boss.hp -= dmg;
          this.justDamagedBoss = true;
          this.lastBossX = bx;
          this.lastBossZ = bz;
          despawnMob(pool, slot);

          if (boss.hp <= 0) {
            boss.hp = 0;
            boss.isDefeated = true;
            this.justDefeatedBoss = true;
            break; // Boss defeated
          }
        }
      }
    }
  }
}
