import { CONFIG } from '../config/constants';
import { MobPool, despawnMob } from './pool';
import { SpatialHashGrid } from './spatial_hash';
import { BaseDefense } from './base';

export interface CombatStats {
  blueKilled: number;
  redKilled: number;
}

/**
 * Combat Resolver for Milestone M3.
 * Pure TypeScript: zero allocations in the frame loop, deterministic slot ordering.
 * Resolves blue vs red unit collisions using uniform spatial hash grid inline traversal.
 */
export class CombatResolver {
  public readonly spatialHash: SpatialHashGrid;
  private readonly blueSlots: Int32Array;
  private readonly contactRadiusSq: number;
  private readonly maxContactsPerTick: number;

  public justHadCombatHit = false;
  public lastHitX = 0;
  public lastHitZ = 0;
  public justHadBaseBreach = false;

  constructor(
    spatialHash: SpatialHashGrid = new SpatialHashGrid(),
    maxUnits: number = CONFIG.MAX_UNITS
  ) {
    this.spatialHash = spatialHash;
    this.blueSlots = new Int32Array(maxUnits);

    const contactDiameter = 2 * CONFIG.MOB_RADIUS;
    this.contactRadiusSq = contactDiameter * contactDiameter;
    this.maxContactsPerTick = CONFIG.MAX_CONTACTS_PER_TICK;
  }

  /**
   * Resolves combat collisions between Blue (Team 0) and Red (Team 1) units.
   * Execution steps:
   * 1. Clear spatial hash and bin all active Red units.
   * 2. Snapshot active Blue unit slot indices into pre-allocated typed buffer.
   * 3. Iterate Blue units in ascending slot order, scanning 3x3 adjacent cells in row-major order.
   * 4. For each contact: resolve 1-to-1 attrition and weight decrementing.
   */
  public resolveCombat(pool: MobPool): CombatStats {
    let blueKilled = 0;
    let redKilled = 0;
    this.justHadCombatHit = false;

    // 1. Bin all active Red units (Team 1) into spatial hash
    this.spatialHash.clear();
    let blueCount = 0;

    for (let i = 0; i < pool.count; i++) {
      const slot = pool.activeIndices[i];
      if (pool.team[slot] === 1) {
        this.spatialHash.insert(slot, pool.x[slot], pool.z[slot]);
      } else {
        this.blueSlots[blueCount++] = slot;
      }
    }

    if (blueCount === 0) {
      return { blueKilled: 0, redKilled: 0 };
    }

    // 2. Iterate Blue units deterministically
    const rDistSq = this.contactRadiusSq;
    const maxContacts = this.maxContactsPerTick;

    for (let i = 0; i < blueCount; i++) {
      const bSlot = this.blueSlots[i];
      if (pool.active[bSlot] === 0) continue;

      const bx = pool.x[bSlot];
      const bz = pool.z[bSlot];

      const { col, row } = this.spatialHash.getCellCoord(bx, bz);
      const minC = Math.max(0, col - 1);
      const maxC = Math.min(this.spatialHash.cols - 1, col + 1);
      const minR = Math.max(0, row - 1);
      const maxR = Math.min(this.spatialHash.rows - 1, row + 1);

      let contacts = 0;

      // Scan 3x3 cells row-major: (-1, -1) to (+1, +1)
      cellLoop: for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const cellIdx = this.spatialHash.getCellIndexByCoord(c, r);
          let rSlot = this.spatialHash.getHead(cellIdx);

          while (rSlot !== -1) {
            // Check if red unit is still active (hasn't been destroyed in previous contact)
            if (pool.active[rSlot] === 1) {
              const dx = bx - pool.x[rSlot];
              const dz = bz - pool.z[rSlot];
              const distSq = dx * dx + dz * dz;

              if (distSq <= rDistSq) {
                contacts++;
                this.justHadCombatHit = true;
                this.lastHitX = bx;
                this.lastHitZ = bz;

                const wb = pool.weight[bSlot];
                const wr = pool.weight[rSlot];

                if (wb > wr) {
                  // Red destroyed; Blue survives with reduced weight
                  pool.weight[bSlot] = wb - wr;
                  despawnMob(pool, rSlot);
                  redKilled++;
                } else if (wr > wb) {
                  // Blue destroyed; Red survives with reduced weight
                  pool.weight[rSlot] = wr - wb;
                  despawnMob(pool, bSlot);
                  blueKilled++;
                  break cellLoop; // Blue is dead; cannot resolve further contacts
                } else {
                  // wb == wr: Mutual destruction
                  despawnMob(pool, rSlot);
                  despawnMob(pool, bSlot);
                  redKilled++;
                  blueKilled++;
                  break cellLoop; // Blue is dead
                }

                if (contacts >= maxContacts) {
                  break cellLoop;
                }
              }
            }

            rSlot = this.spatialHash.getNext(rSlot);
          }
        }
      }
    }

    return { blueKilled, redKilled };
  }

  /**
   * Checks for red units that reached or breached the base line (Z <= BASE_Z).
   * Inflicts damage (weight * RED_MOB_BASE_DAMAGE) and despawns breaching units.
   */
  public checkBaseBreaches(pool: MobPool, baseDefense: BaseDefense): number {
    this.justHadBaseBreach = false;
    if (baseDefense.isGameOver || pool.count === 0) return 0;

    let totalDamage = 0;
    const baseZ = CONFIG.BASE_Z;
    const damagePerUnit = CONFIG.RED_MOB_BASE_DAMAGE;

    // Iterate backwards so despawnMob swap-and-pop is safe
    for (let i = pool.count - 1; i >= 0; i--) {
      const slot = pool.activeIndices[i];
      if (pool.team[slot] === 1 && pool.z[slot] <= baseZ) {
        const dmg = pool.weight[slot] * damagePerUnit;
        totalDamage += dmg;
        this.justHadBaseBreach = true;
        baseDefense.takeDamage(dmg);
        despawnMob(pool, slot);

        if (baseDefense.isGameOver) {
          break;
        }
      }
    }

    return totalDamage;
  }
}
