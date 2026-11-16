import { CONFIG } from '../config/constants';
import { MobPool } from './pool';
import { CannonSim } from './cannon';

export interface PickupData {
  readonly id: number;
  readonly kind: 'upgrade';
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export class PickupSim {
  public readonly id: number;
  public readonly kind: 'upgrade';
  public readonly x: number;
  public readonly z: number;
  public readonly radius: number;
  public isCollected: boolean = false;

  constructor(data: PickupData) {
    this.id = data.id;
    this.kind = data.kind;
    this.x = data.x;
    this.z = data.z;
    this.radius = data.radius;
    this.isCollected = false;
  }

  public reset(): void {
    this.isCollected = false;
  }
}

export class PickupManager {
  public pickups: PickupSim[] = [];
  public justCollectedUpgrade: boolean = false;

  constructor(pickupsData: PickupData[] = []) {
    this.setPickups(pickupsData);
  }

  public setPickups(pickupsData: PickupData[]): void {
    this.pickups = pickupsData.map((p) => new PickupSim(p));
  }

  public reset(pickupsData?: PickupData[]): void {
    this.justCollectedUpgrade = false;
    if (pickupsData) {
      this.setPickups(pickupsData);
    } else {
      for (let i = 0; i < this.pickups.length; i++) {
        this.pickups[i].reset();
      }
    }
  }

  /**
   * Resolves player blue unit contact with level pickups.
   * On contact, triggers effects (e.g. cannon tier upgrade) and sets isCollected.
   * Zero heap allocations during frame tick.
   */
  public update(pool: MobPool, cannon: CannonSim): void {
    this.justCollectedUpgrade = false;
    if (this.pickups.length === 0 || pool.count === 0) return;

    for (let p = 0; p < this.pickups.length; p++) {
      const pickup = this.pickups[p];
      if (pickup.isCollected) continue;

      const px = pickup.x;
      const pz = pickup.z;
      const hitRadius = pickup.radius + CONFIG.MOB_RADIUS;
      const hitRadiusSq = hitRadius * hitRadius;

      // Check active blue mobs
      const count = pool.count;
      for (let i = 0; i < count; i++) {
        const slot = pool.activeIndices[i];
        if (pool.team[slot] !== 0) continue; // Blue team only

        const dz = pool.z[slot] - pz;
        if (Math.abs(dz) > hitRadius) continue;

        const dx = pool.x[slot] - px;
        if (Math.abs(dx) > hitRadius) continue;

        if (dx * dx + dz * dz <= hitRadiusSq) {
          pickup.isCollected = true;
          if (pickup.kind === 'upgrade') {
            cannon.upgradeTier();
            this.justCollectedUpgrade = true;
          }
          break;
        }
      }
    }
  }
}
