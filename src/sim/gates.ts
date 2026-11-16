import { CONFIG } from '../config/constants';
import { MobPool, spawnMob, despawnMob } from './pool';
import { SeededRNG } from './rng';

export type GateKind = 'add' | 'mul' | 'sub' | 'div';

export interface Gate {
  readonly id: number;
  readonly kind: GateKind;
  readonly value: number;
  readonly x: number;
  readonly width: number;
  readonly z: number;
  remainingValue: number; // Mutated during simulation (e.g. for add/sub consumption)
}

/**
 * Pure math function: calculates net swarm size resulting from a gate.
 * Used for deterministic validation and unit tests.
 */
export function calculateGateOutput(kind: GateKind, value: number, currentCount: number): number {
  switch (kind) {
    case 'add':
      return currentCount + value;
    case 'mul':
      return currentCount * value;
    case 'sub':
      return Math.max(0, currentCount - value);
    case 'div':
      return Math.max(0, Math.floor(currentCount / value));
  }
}

/**
 * Pure helper to create an immutable gate specification with runtime remaining budget.
 */
export function createGate(
  id: number,
  kind: GateKind,
  value: number,
  x: number,
  width: number,
  z: number
): Gate {
  return {
    id,
    kind,
    value,
    x,
    width,
    z,
    remainingValue: value
  };
}

/**
 * Pre-allocated ring buffer for buffering excess clone spawns across frames.
 * Zero-allocation in the frame loop.
 */
class CloneRingBuffer {
  private readonly capacity: number = 2000;
  private head: number = 0;
  private tail: number = 0;
  public count: number = 0;

  public readonly x: Float32Array = new Float32Array(2000);
  public readonly z: Float32Array = new Float32Array(2000);
  public readonly vx: Float32Array = new Float32Array(2000);
  public readonly vz: Float32Array = new Float32Array(2000);
  public readonly team: Uint8Array = new Uint8Array(2000);
  public readonly weight: Uint16Array = new Uint16Array(2000);
  public readonly lastGateId: Int32Array = new Int32Array(2000);

  public push(
    x: number,
    z: number,
    vx: number,
    vz: number,
    team: number,
    weight: number,
    lastGateId: number
  ): boolean {
    if (this.count >= this.capacity) {
      return false; // Buffer full
    }
    const idx = this.tail;
    this.x[idx] = x;
    this.z[idx] = z;
    this.vx[idx] = vx;
    this.vz[idx] = vz;
    this.team[idx] = team;
    this.weight[idx] = weight;
    this.lastGateId[idx] = lastGateId;

    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  public popIntoPool(pool: MobPool, maxCount: number): number {
    let spawned = 0;
    while (this.count > 0 && spawned < maxCount) {
      const idx = this.head;
      spawnMob(
        pool,
        this.x[idx],
        this.z[idx],
        this.vx[idx],
        this.vz[idx],
        this.team[idx],
        0, // tier
        1, // hp
        1, // damage
        this.weight[idx],
        this.lastGateId[idx]
      );

      this.head = (this.head + 1) % this.capacity;
      this.count--;
      spawned++;
    }
    return spawned;
  }

  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}

/**
 * Gate Manager: Handles gate plane crossings, clone inheritance, $z$-offsetting,
 * and rate-limited clone spawning.
 */
export class GateManager {
  private gates: Gate[] = [];
  private cloneBuffer = new CloneRingBuffer();
  private rng: SeededRNG;

  public justCrossedGate = false;
  public lastCrossedGateX = 0;
  public lastCrossedGateZ = 0;

  // Divider tracking per gate: tracks remainder of units passing through
  private divCounter: Map<number, number> = new Map();

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  public setGates(gates: Gate[]): void {
    this.gates = gates;
    this.cloneBuffer.clear();
    this.divCounter.clear();
  }

  public getGates(): readonly Gate[] {
    return this.gates;
  }

  public reset(): void {
    this.cloneBuffer.clear();
    this.divCounter.clear();
    this.justCrossedGate = false;
    for (const gate of this.gates) {
      gate.remainingValue = gate.value;
    }
  }

  /**
   * Main gate step: tests all active mobs against gates and steps the clone buffer.
   */
  public update(pool: MobPool, dt: number): void {
    // 1. Drain pending clones from previous frame bursts (up to per-tick budget)
    let budgetRemaining: number = CONFIG.GATES.MAX_CLONES_PER_TICK;
    const clonesPopped = this.cloneBuffer.popIntoPool(pool, budgetRemaining);
    budgetRemaining = Math.max(0, budgetRemaining - clonesPopped);

    // 2. Check gate crossings for active units
    // Iterate backwards so despawns (sub/div) don't disrupt dense index iteration
    for (let i = pool.count - 1; i >= 0; i--) {
      const slot = pool.activeIndices[i];
      if (pool.team[slot] !== 0) continue; // Only player blue units pass gates

      const currZ = pool.z[slot];
      const vz = pool.vz[slot];
      const prevZ = currZ - vz * dt;
      const unitX = pool.x[slot];
      const unitLastGateId = pool.lastGateId[slot];

      for (let g = 0; g < this.gates.length; g++) {
        const gate = this.gates[g];

        // Check if unit crossed gate plane this tick
        if (prevZ <= gate.z && currZ >= gate.z) {
          // Check lateral boundaries
          const halfWidth = gate.width / 2;
          if (unitX >= gate.x - halfWidth && unitX <= gate.x + halfWidth) {
            // Check gate state: once a unit passes a gate, it cannot trigger it again
            if (unitLastGateId !== gate.id) {
              pool.lastGateId[slot] = gate.id;

              const spawned = this.handleGateTrigger(
                gate,
                pool,
                slot,
                unitX,
                vz,
                budgetRemaining
              );
              budgetRemaining = Math.max(0, budgetRemaining - spawned);
            }
          }
        }
      }
    }
  }

  private handleGateTrigger(
    gate: Gate,
    pool: MobPool,
    passingSlot: number,
    unitX: number,
    vz: number,
    immediateBudget: number
  ): number {
    this.justCrossedGate = true;
    this.lastCrossedGateX = unitX;
    this.lastCrossedGateZ = gate.z;
    const unitWeight = pool.weight[passingSlot];

    switch (gate.kind) {
      case 'mul': {
        // xN multiplies this unit into N units (creates (N - 1) * weight new clones)
        const clonesNeeded = (gate.value - 1) * unitWeight;
        return this.spawnOrQueueClones(
          pool,
          gate,
          clonesNeeded,
          unitX,
          vz,
          gate.id,
          immediateBudget
        );
      }

      case 'add': {
        // +N grants N extra clones per unit passing through (persistent gate, active on every mob)
        const clonesNeeded = gate.value * unitWeight;
        return this.spawnOrQueueClones(
          pool,
          gate,
          clonesNeeded,
          unitX,
          vz,
          gate.id,
          immediateBudget
        );
      }

      case 'sub': {
        // -N consumes passing units until subtract budget is depleted
        if (gate.remainingValue > 0) {
          if (unitWeight <= gate.remainingValue) {
            gate.remainingValue -= unitWeight;
            despawnMob(pool, passingSlot);
          } else {
            pool.weight[passingSlot] -= gate.remainingValue;
            gate.remainingValue = 0;
          }
        }
        return 0;
      }

      case 'div': {
        // /N keeps 1 unit out of every N units passing through
        const currentAccum = (this.divCounter.get(gate.id) || 0) + 1;
        if (currentAccum % gate.value !== 0) {
          despawnMob(pool, passingSlot);
        }
        this.divCounter.set(gate.id, currentAccum);
        return 0;
      }
    }
  }

  private spawnOrQueueClones(
    pool: MobPool,
    gate: Gate,
    count: number,
    centerX: number,
    vz: number,
    gateId: number,
    immediateBudget: number
  ): number {
    let spawnedImmediate = 0;
    const spawnZ = gate.z + CONFIG.GATES.PLANE_OFFSET_Z;

    const laneMinX = gate.x - gate.width / 2 + CONFIG.MOB_RADIUS + 0.1;
    const laneMaxX = gate.x + gate.width / 2 - CONFIG.MOB_RADIUS - 0.1;

    for (let c = 0; c < count; c++) {
      // Fan out clones laterally across the lane around the parent mob
      const fanOffset =
        count === 1
          ? (this.rng.nextFloat() - 0.5) * 0.8
          : ((c + 0.5) - count / 2) * Math.min(0.65, (gate.width * 0.75) / count) +
            (this.rng.nextFloat() - 0.5) * 0.2;

      const cloneX = Math.max(laneMinX, Math.min(laneMaxX, centerX + fanOffset));

      // Small lateral expansion impulse so the mob crowd blossoms naturally
      const cloneVx = fanOffset * 0.8;

      if (spawnedImmediate < immediateBudget) {
        spawnMob(
          pool,
          cloneX,
          spawnZ,
          cloneVx,
          vz,
          0, // team 0 = blue
          0, // tier
          1, // hp
          1, // damage
          1, // weight
          gateId // strictly inherited gate ID
        );
        spawnedImmediate++;
      } else {
        // Buffer remainder for subsequent ticks to prevent frame spikes
        this.cloneBuffer.push(cloneX, spawnZ, cloneVx, vz, 0, 1, gateId);
      }
    }

    return spawnedImmediate;
  }

  public getPendingBufferCount(): number {
    return this.cloneBuffer.count;
  }
}
