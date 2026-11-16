/**
 * Structure of Arrays (SoA) Typed Array Unit Pool.
 * Zero-allocation in the frame loop: primitives-only APIs, free-list recycling,
 * and dense active list tracking.
 * Pure TypeScript: no Three.js, no DOM.
 */
export interface MobPool {
  readonly capacity: number;
  count: number;

  // Spatial coordinates
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vz: Float32Array;

  // Attributes
  readonly hp: Float32Array;
  readonly damage: Float32Array;
  readonly weight: Uint16Array;
  readonly team: Uint8Array; // 0 = Blue (Player), 1 = Red (Enemy)
  readonly tier: Uint8Array;
  readonly lastGateId: Int32Array; // -1 = none, or gate ID if passed
  readonly active: Uint8Array;

  // Dense list of active indices for O(count) iteration without full capacity scans
  readonly activeIndices: Int32Array;
  // Dense to sparse map: activeIndicesMap[slot] = index in activeIndices
  readonly activeIndicesMap: Int32Array;

  // Free-list stack
  readonly freeIndices: Int32Array;
  freeCount: number;
}

export function createMobPool(capacity: number): MobPool {
  const freeIndices = new Int32Array(capacity);
  const activeIndices = new Int32Array(capacity);
  const activeIndicesMap = new Int32Array(capacity);
  const lastGateId = new Int32Array(capacity);

  // Initialize free-list with all slot indices [0, 1, ..., capacity - 1]
  for (let i = 0; i < capacity; i++) {
    freeIndices[i] = i;
    activeIndicesMap[i] = -1;
    lastGateId[i] = -1;
  }

  return {
    capacity,
    count: 0,
    x: new Float32Array(capacity),
    z: new Float32Array(capacity),
    vx: new Float32Array(capacity),
    vz: new Float32Array(capacity),
    hp: new Float32Array(capacity),
    damage: new Float32Array(capacity),
    weight: new Uint16Array(capacity),
    team: new Uint8Array(capacity),
    tier: new Uint8Array(capacity),
    lastGateId,
    active: new Uint8Array(capacity),
    activeIndices,
    activeIndicesMap,
    freeIndices,
    freeCount: capacity
  };
}

/**
 * Resets the mob pool back to initial empty state without any allocations.
 * Restores freeIndices order and resets active lists.
 */
export function resetMobPool(pool: MobPool): void {
  pool.count = 0;
  pool.freeCount = pool.capacity;
  pool.active.fill(0);
  for (let i = 0; i < pool.capacity; i++) {
    pool.freeIndices[i] = i;
    pool.activeIndicesMap[i] = -1;
    pool.lastGateId[i] = -1;
  }
}

/**
 * Allocates a mob from the pool using primitive arguments (zero object allocation).
 * If pool is full, merges weight into the most recently active unit of same team (Cap Overflow).
 * Returns:
 *   >= 0: allocated slot index
 *   -2: capacity reached, spawn merged into existing unit's weight
 */
export function spawnMob(
  pool: MobPool,
  x: number,
  z: number,
  vx: number,
  vz: number,
  team: number,
  tier: number = 0,
  hp: number = 1,
  damage: number = 1,
  weight: number = 1,
  lastGateId: number = -1
): number {
  if (pool.freeCount === 0) {
    // Cap overflow handling: merge weight into existing unit rather than silent drop
    if (pool.count > 0) {
      for (let i = pool.count - 1; i >= 0; i--) {
        const slot = pool.activeIndices[i];
        if (pool.team[slot] === team) {
          pool.weight[slot] = Math.min(65535, pool.weight[slot] + weight);
          return -2;
        }
      }
    }
    return -2;
  }

  // Pop from free list
  pool.freeCount--;
  const slot = pool.freeIndices[pool.freeCount];

  // Set spatial & kinematic state
  pool.x[slot] = x;
  pool.z[slot] = z;
  pool.vx[slot] = vx;
  pool.vz[slot] = vz;

  // Set attributes
  pool.hp[slot] = hp;
  pool.damage[slot] = damage;
  pool.weight[slot] = weight;
  pool.team[slot] = team;
  pool.tier[slot] = tier;
  // Pool slots strictly reset lastGateId to -1 unless explicitly inherited (e.g. from gate clone)
  pool.lastGateId[slot] = lastGateId;
  pool.active[slot] = 1;

  // Add to active dense list
  const activeIdx = pool.count;
  pool.activeIndices[activeIdx] = slot;
  pool.activeIndicesMap[slot] = activeIdx;
  pool.count++;

  return slot;
}

/**
 * Despawns a mob and returns its slot to the free-list.
 * Guarantees that lastGateId is reset to -1 upon recycling.
 */
export function despawnMob(pool: MobPool, slot: number): boolean {
  if (pool.active[slot] === 0) {
    return false;
  }

  pool.active[slot] = 0;
  // Reset lastGateId so the recycled slot is clean
  pool.lastGateId[slot] = -1;
  pool.weight[slot] = 1;

  // Remove from dense active list in O(1) using swap-and-pop
  const activeIdx = pool.activeIndicesMap[slot];
  const lastActiveIdx = pool.count - 1;

  if (activeIdx !== lastActiveIdx) {
    const lastSlot = pool.activeIndices[lastActiveIdx];
    pool.activeIndices[activeIdx] = lastSlot;
    pool.activeIndicesMap[lastSlot] = activeIdx;
  }

  pool.activeIndicesMap[slot] = -1;
  pool.count--;

  // Push back onto free list
  pool.freeIndices[pool.freeCount] = slot;
  pool.freeCount++;

  return true;
}
