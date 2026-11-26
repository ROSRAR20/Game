import { CONFIG } from '../config/constants';
import { MobPool, despawnMob } from './pool';
import { CannonSim } from './cannon';

export type StatueRewardKind = 'tier' | 'overdrive';

export interface SlidingStatue {
  id: number;
  slotIndex: 0 | 1 | 2;
  x: number;
  z: number;
  targetZ: number;
  radius: number;
  hp: number;
  maxHp: number;
  rewardKind: StatueRewardKind;
  rewardTier: number; // 1..9 for tier statues, 0 for overdrive
  isHittable: boolean;
}

export interface StatueUpdateResult {
  destroyedStatue: SlidingStatue | null;
  rewardGranted: StatueRewardKind | null;
  rewardTier: number;
  scoreAwarded: number;
}

/**
 * Steeper quadratic HP scaling calibrated for 10 tiers:
 * HP_K = 27 * K + 15 * (K - 1)^2
 * (27, 69, 141, 243, 375, 537, 729, 951, 1203, 1485)
 */
export function getStatueMaxHp(statueIndex: number): number {
  const k = Math.max(1, Math.floor(statueIndex));
  return CONFIG.STATUES.BASE_HP + (k - 1) * CONFIG.STATUES.HP_STEP + CONFIG.STATUES.QUADRATIC_STEP * (k - 1) * (k - 1);
}

export function getStatueRewardKind(statueIndex: number): StatueRewardKind {
  return statueIndex <= CONFIG.MAX_TIER ? 'tier' : 'overdrive';
}

export class StatueQueueManager {
  public statues: SlidingStatue[] = [];
  public nextId: number = 1;
  public destroyedCount: number = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.statues = [];
    this.nextId = 1;
    this.destroyedCount = 0;

    for (let slot = 0; slot < 3; slot++) {
      const z = CONFIG.STATUES.SLOT_Z[slot];
      this.statues.push(this.createStatue(slot as 0 | 1 | 2, z, z));
    }
  }

  private createStatue(slotIndex: 0 | 1 | 2, z: number, targetZ: number): SlidingStatue {
    const id = this.nextId++;
    const maxHp = getStatueMaxHp(id);
    const rewardKind = getStatueRewardKind(id);
    return {
      id,
      slotIndex,
      x: CONFIG.STATUES.LANE_X,
      z,
      targetZ,
      radius: CONFIG.STATUES.RADIUS,
      hp: maxHp,
      maxHp,
      rewardKind,
      rewardTier: rewardKind === 'tier' ? id : 0,
      isHittable: slotIndex === 0 && z <= CONFIG.STATUES.HITTABLE_Z_THRESHOLD
    };
  }

  public update(dt: number, pool: MobPool, cannon: CannonSim): StatueUpdateResult {
    let destroyedStatue: SlidingStatue | null = null;
    let rewardGranted: StatueRewardKind | null = null;
    let rewardTier = 0;
    let scoreAwarded = 0;

    // 1. Advance queue slide positions
    const slideStep = CONFIG.STATUES.SLIDE_SPEED * dt;
    for (let i = 0; i < this.statues.length; i++) {
      const s = this.statues[i];
      if (s.z > s.targetZ) {
        s.z = Math.max(s.targetZ, s.z - slideStep);
      }
      s.isHittable = s.slotIndex === 0 && s.z <= CONFIG.STATUES.HITTABLE_Z_THRESHOLD;
    }

    // 2. Check Blue unit collisions ONLY against Slot 0 (Front Statue) when hittable
    const front = this.statues[0];
    if (!front || !front.isHittable) {
      return { destroyedStatue, rewardGranted, rewardTier, scoreAwarded };
    }

    const hitRadius = front.radius + CONFIG.MOB_RADIUS;
    const hitRadiusSq = hitRadius * hitRadius;

    for (let i = pool.count - 1; i >= 0; i--) {
      const slot = pool.activeIndices[i];
      if (pool.team[slot] !== 0) continue; // Only Blue units hit statues

      const dx = pool.x[slot] - front.x;
      const dz = pool.z[slot] - front.z;
      if (dx * dx + dz * dz <= hitRadiusSq) {
        const dmg = pool.damage[slot] * pool.weight[slot];
        front.hp -= dmg;
        despawnMob(pool, slot);

        if (front.hp <= 0) {
          front.hp = 0;
          destroyedStatue = { ...front };
          rewardGranted = front.rewardKind;
          rewardTier = front.rewardTier;
          this.destroyedCount++;

          if (rewardGranted === 'tier') {
            cannon.setTier(Math.max(cannon.tier, rewardTier));
            scoreAwarded = CONFIG.STATUES.UPGRADE_SCORE;
          } else {
            cannon.activateOverdrive();
            scoreAwarded = CONFIG.STATUES.OVERDRIVE_SCORE;
          }

          // Pop front statue and shift queue forward
          this.statues.shift();
          for (let q = 0; q < this.statues.length; q++) {
            this.statues[q].slotIndex = q as 0 | 1 | 2;
            this.statues[q].targetZ = CONFIG.STATUES.SLOT_Z[q];
            this.statues[q].isHittable = false;
          }
          // Spawn new statue emerging from Right Tunnel mouth into Slot 3
          this.statues.push(
            this.createStatue(2, CONFIG.STATUES.SPAWN_Z, CONFIG.STATUES.SLOT_Z[2])
          );
          break;
        }
      }
    }

    return { destroyedStatue, rewardGranted, rewardTier, scoreAwarded };
  }
}
