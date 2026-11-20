import { describe, it, expect } from 'vitest';
import { CannonSim } from '../../src/sim/cannon';
import { CONFIG } from '../../src/config/constants';
import { createMobPool } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';

describe('Cannon Tiers Configuration & Firing Patterns', () => {
  it('adheres to configured per-tier cadence, volley counts, and unit attributes', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(50);
    const rng = new SeededRNG(1234);

    // --- Tier 0: Single Cannon ---
    expect(cannon.tier).toBe(0);
    expect(cannon.fireInterval).toBeCloseTo(1 / 6, 4);

    cannon.update(0.17, pool, rng);
    expect(pool.count).toBe(1);
    const slot0 = pool.activeIndices[0];
    expect(pool.tier[slot0]).toBe(0);
    expect(pool.weight[slot0]).toBe(1);
    expect(pool.hp[slot0]).toBe(1);
    expect(pool.damage[slot0]).toBe(1);

    // --- Tier 1: Triple Cannon ---
    expect(cannon.upgradeTier()).toBe(true);
    expect(cannon.tier).toBe(1);
    expect(cannon.fireInterval).toBeCloseTo(1 / 5, 4);

    pool.count = 0;
    cannon.update(0.21, pool, rng);
    expect(pool.count).toBe(3); // 3 units in volley

    const offsetsT1 = [-0.38, 0, 0.38];
    for (let i = 0; i < 3; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.tier[slot]).toBe(1);
      expect(pool.weight[slot]).toBe(2);
      expect(pool.hp[slot]).toBe(2);
      expect(pool.damage[slot]).toBe(2);
      expect(pool.x[slot]).toBeCloseTo(offsetsT1[i], 1);
    }

    // --- Tier 2: Combat Squad ---
    expect(cannon.upgradeTier()).toBe(true);
    expect(cannon.tier).toBe(2);
    expect(cannon.fireInterval).toBeCloseTo(1 / 4, 4);

    pool.count = 0;
    cannon.update(0.26, pool, rng);
    expect(pool.count).toBe(5); // 5 units in volley

    const offsetsT2 = [-0.6, -0.3, 0, 0.3, 0.6];
    for (let i = 0; i < 5; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.tier[slot]).toBe(2);
      expect(pool.weight[slot]).toBe(4);
      expect(pool.hp[slot]).toBe(4);
      expect(pool.damage[slot]).toBe(3);
      expect(pool.x[slot]).toBeCloseTo(offsetsT2[i], 1);
    }
  });

  it('reset returns cannon to Tier 0 with single cannon interval', () => {
    const cannon = new CannonSim();
    cannon.upgradeTier();
    cannon.upgradeTier();
    expect(cannon.tier).toBe(2);

    cannon.reset();
    expect(cannon.tier).toBe(0);
    expect(cannon.fireInterval).toBeCloseTo(CONFIG.CANNON_TIER_CONFIG[0].fireInterval, 4);
    expect(cannon.x).toBe(0);
  });
});
