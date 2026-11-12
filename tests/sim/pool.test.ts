import { describe, it, expect } from 'vitest';
import { createMobPool, spawnMob, despawnMob } from '../../src/sim/pool';

describe('Structure of Arrays MobPool', () => {
  it('allocates slots and maintains count correctly', () => {
    const pool = createMobPool(10);
    expect(pool.count).toBe(0);
    expect(pool.freeCount).toBe(10);

    const slot0 = spawnMob(pool, 1, 2, 0, 10, 0);
    expect(slot0).toBeGreaterThanOrEqual(0);
    expect(pool.count).toBe(1);
    expect(pool.freeCount).toBe(9);
    expect(pool.x[slot0]).toBe(1);
    expect(pool.z[slot0]).toBe(2);
    expect(pool.lastGateId[slot0]).toBe(-1);
    expect(pool.active[slot0]).toBe(1);
  });

  it('resets lastGateId to -1 when a slot is recycled from the pool', () => {
    const pool = createMobPool(5);

    // Spawn a unit and simulate it having triggered a gate
    const slot = spawnMob(pool, 0, 10, 0, 12, 0);
    pool.lastGateId[slot] = 42; // Unit passed gate ID 42
    expect(pool.lastGateId[slot]).toBe(42);

    // Despawn unit back to pool
    const despawned = despawnMob(pool, slot);
    expect(despawned).toBe(true);
    expect(pool.lastGateId[slot]).toBe(-1); // Reset upon despawn
    expect(pool.active[slot]).toBe(0);

    // Reallocate the same slot
    const reusedSlot = spawnMob(pool, 2, 0, 0, 12, 0);
    expect(reusedSlot).toBe(slot);
    // Guarantees clean slot on reuse
    expect(pool.lastGateId[reusedSlot]).toBe(-1);
  });

  it('handles cap overflow by incrementing weight instead of HP', () => {
    const pool = createMobPool(2);

    // Allocate pool to maximum capacity
    const s1 = spawnMob(pool, 0, 0, 0, 10, 0, 0, 1, 1, 1);
    const s2 = spawnMob(pool, 1, 1, 0, 10, 0, 0, 1, 1, 1);
    expect(pool.freeCount).toBe(0);
    expect(pool.count).toBe(2);

    // Attempting to spawn when pool is full triggers cap overflow
    const overflowResult = spawnMob(pool, 2, 2, 0, 10, 0, 0, 1, 1, 1);

    expect(overflowResult).toBe(-2);
    expect(pool.count).toBe(2); // Count capped at 2

    // Unit weight incremented on living unit, HP unchanged!
    expect(pool.weight[s2]).toBe(2);
    expect(pool.hp[s2]).toBe(1); // HP NOT inflated
    expect(pool.hp[s1]).toBe(1);
  });

  it('allows inheriting explicit lastGateId when specified (for gate clones)', () => {
    const pool = createMobPool(5);
    const cloneSlot = spawnMob(
      pool,
      0.5,
      15.1,
      0,
      12,
      0,
      0,
      1,
      1,
      1,
      77 // Explicitly inherited from parent gate
    );

    expect(pool.lastGateId[cloneSlot]).toBe(77);
  });
});
