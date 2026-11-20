import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';

function computeSimStateHash(sim: Simulation): string {
  let hash = 2166136261; // FNV 32-bit offset basis
  const prime = 16777619;

  function addInt(val: number): void {
    hash ^= val & 0xffffffff;
    hash = Math.imul(hash, prime);
  }

  function addFloat(val: number): void {
    // Quantize float to fixed integer representation to avoid micro precision drift
    addInt(Math.round(val * 1000));
  }

  addFloat(sim.base.hp);
  addFloat(sim.cannon.x);
  addInt(sim.cannon.tier);
  addInt(sim.pool.count);
  addInt(sim.pool.freeCount);
  addInt(sim.rng.getState());

  for (const tower of sim.towers.towers) {
    addFloat(tower.hp);
    addInt(tower.isDestroyed ? 1 : 0);
  }
  for (const boss of sim.bosses.bosses) {
    addFloat(boss.hp);
    addFloat(boss.z);
    addInt(boss.isDefeated ? 1 : 0);
  }
  for (const pickup of sim.pickups.pickups) {
    addInt(pickup.isCollected ? 1 : 0);
  }

  // Sort active slots by their slot index or position for stable hashing
  const slots: number[] = [];
  for (let i = 0; i < sim.pool.count; i++) {
    slots.push(sim.pool.activeIndices[i]);
  }
  slots.sort((a, b) => a - b);

  for (const slot of slots) {
    addFloat(sim.pool.x[slot]);
    addFloat(sim.pool.z[slot]);
    addFloat(sim.pool.vx[slot]);
    addFloat(sim.pool.vz[slot]);
    addInt(sim.pool.weight[slot]);
    addInt(sim.pool.team[slot]);
    addInt(sim.pool.tier[slot]);
    addFloat(sim.pool.hp[slot]);
  }

  return (hash >>> 0).toString(16);
}

describe('Determinism & Headless Invariants (M3)', () => {
  it('produces identical state hash across two independent 60-second runs (3,600 ticks)', () => {
    const seed = 42;
    const sim1 = new Simulation(seed);
    const sim2 = new Simulation(seed);

    const totalTicks = 60 * 60; // 3,600 ticks = 60 seconds

    for (let tick = 0; tick < totalTicks; tick++) {
      sim1.step(CONFIG.FIXED_DELTA_TIME);
      sim2.step(CONFIG.FIXED_DELTA_TIME);

      // Verify unit count conservation at every tick
      expect(sim1.pool.count + sim1.pool.freeCount).toBe(CONFIG.MAX_UNITS);
      expect(sim2.pool.count + sim2.pool.freeCount).toBe(CONFIG.MAX_UNITS);

      // Headless invariants verification every 60 ticks (1 second of sim time)
      if (tick % 60 === 0) {
        // Base defense invariants
        expect(Number.isFinite(sim1.base.hp)).toBe(true);
        expect(sim1.base.hp).toBeGreaterThanOrEqual(0);

        // Mob pool invariants
        for (let i = 0; i < sim1.pool.count; i++) {
          const slot = sim1.pool.activeIndices[i];
          expect(Number.isFinite(sim1.pool.x[slot])).toBe(true);
          expect(Number.isFinite(sim1.pool.z[slot])).toBe(true);
          expect(Number.isFinite(sim1.pool.vx[slot])).toBe(true);
          expect(Number.isFinite(sim1.pool.vz[slot])).toBe(true);
          expect(sim1.pool.hp[slot]).toBeGreaterThan(0);
          expect(sim1.pool.weight[slot]).toBeGreaterThanOrEqual(1);
          expect(sim1.pool.team[slot] === 0 || sim1.pool.team[slot] === 1).toBe(true);
        }
      }
    }

    const hash1 = computeSimStateHash(sim1);
    const hash2 = computeSimStateHash(sim2);

    expect(hash1).toBe(hash2);
    expect(sim1.base.hp).toBe(sim2.base.hp);
    expect(sim1.pool.count).toBe(sim2.pool.count);
  });

  it('matches bit-for-bit after Game Over then Restart compared to a fresh run from tick 0', () => {
    const seed = 9876;
    const simRestarted = new Simulation(seed);
    const simFresh = new Simulation(seed);

    // Run simRestarted until base falls or reaches Game Over
    for (let i = 0; i < 300; i++) {
      simRestarted.step(CONFIG.FIXED_DELTA_TIME);
    }
    // Force Game Over by dealing lethal base damage
    simRestarted.base.takeDamage(100);
    expect(simRestarted.base.isGameOver).toBe(true);

    // Restart simRestarted with initial seed
    simRestarted.restart(seed);
    expect(simRestarted.base.isGameOver).toBe(false);
    expect(simRestarted.base.hp).toBe(CONFIG.BASE_MAX_HP);
    expect(simRestarted.pool.count).toBe(0);

    // Now run both for 600 ticks (10 seconds)
    for (let i = 0; i < 600; i++) {
      simRestarted.step(CONFIG.FIXED_DELTA_TIME);
      simFresh.step(CONFIG.FIXED_DELTA_TIME);
    }

    expect(simRestarted.pool.count).toBe(simFresh.pool.count);
    expect(simRestarted.cannon.x).toBe(simFresh.cannon.x);
    expect(simRestarted.base.hp).toBe(simFresh.base.hp);

    const hashRestarted = computeSimStateHash(simRestarted);
    const hashFresh = computeSimStateHash(simFresh);
    expect(hashRestarted).toBe(hashFresh);
  });

  it('preserves M6 baseline determinism and RNG sequence for Tier 0 at 600 ticks', () => {
    const seed = 42;
    const sim = new Simulation(seed);

    for (let i = 0; i < 600; i++) {
      sim.step(CONFIG.FIXED_DELTA_TIME);
    }

    // Blue mobs moving up center line collect Pickup 201 (LV+1 Gem at Z=24)
    expect(sim.cannon.tier).toBe(1);
    expect(sim.pool.count).toBe(706);
    expect(sim.base.hp).toBe(100);
    expect(sim.rng.getState()).toBe(1813250154912);

    const hash = computeSimStateHash(sim);
    expect(hash).toBe('d7ef2bd7');
  });
});
