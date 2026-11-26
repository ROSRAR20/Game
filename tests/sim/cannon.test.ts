import { describe, it, expect } from 'vitest';
import { CannonSim } from '../../src/sim/cannon';
import { createMobPool } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';
import { CONFIG } from '../../src/config/constants';

describe('Cannon Simulation', () => {
  it('clamps target position within road bounds', () => {
    const cannon = new CannonSim();

    cannon.setTargetX(100);
    expect(cannon.targetX).toBe(CONFIG.CANNON_MAX_X);

    cannon.setTargetX(-100);
    expect(cannon.targetX).toBe(CONFIG.CANNON_MIN_X);
  });

  it('smoothly interpolates cannon position towards target', () => {
    const cannon = new CannonSim();
    cannon.setTargetX(4.0);

    const pool = createMobPool(10);
    const rng = new SeededRNG(1);

    cannon.update(1 / 60, pool, rng);
    expect(cannon.x).toBeGreaterThan(0);
    expect(cannon.x).toBeLessThanOrEqual(4.0);
  });

  it('auto-fires blue mobs at fixed cadence', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(20);
    const rng = new SeededRNG(42);

    expect(pool.count).toBe(0);

    // Step by 1 full second (cannon fire rate is 6 mobs/sec)
    cannon.update(1.0, pool, rng);

    expect(pool.count).toBe(CONFIG.CANNON_FIRE_RATE);
    // All spawned units belong to team 0 (Blue) and have lastGateId = -1
    for (let i = 0; i < pool.count; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.team[slot]).toBe(0);
      expect(pool.lastGateId[slot]).toBe(-1);
      expect(pool.tier[slot]).toBe(0);
      expect(pool.hp[slot]).toBe(1);
    }
  });

  it('upgrades tier and spawns upgraded stats (Model 1: count=number of shooters, tier=shooter type)', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(20);
    const rng = new SeededRNG(42);

    expect(cannon.tier).toBe(0);
    expect(cannon.cannonCount).toBe(1);

    // Set cannon count to 3 shooters
    cannon.setCannonCount(3);
    expect(cannon.cannonCount).toBe(3);

    // Fire at count 3, tier 0: fires 3 shots per volley (1 per shooter)
    cannon.update(0.2, pool, rng);
    expect(pool.count).toBe(3);
    for (let i = 0; i < 3; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.tier[slot]).toBe(0);
      expect(pool.hp[slot]).toBe(1);
      expect(pool.damage[slot]).toBe(1);
    }

    // Upgrade to tier 1
    expect(cannon.upgradeTier()).toBe(true);
    expect(cannon.tier).toBe(1);

    // Fire at count 3, tier 1: fires 3 shots with tier 1 stats (hp 2, dmg 1)
    const prevCountT1 = pool.count;
    cannon.update(0.2, pool, rng);
    expect(pool.count - prevCountT1).toBe(3);
    for (let i = prevCountT1; i < prevCountT1 + 3; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.tier[slot]).toBe(1);
      expect(pool.hp[slot]).toBe(2);
      expect(pool.damage[slot]).toBe(1);
    }

    // Upgrade to tier 2
    expect(cannon.upgradeTier()).toBe(true);
    expect(cannon.tier).toBe(2);
    expect(cannon.upgradeTier(2)).toBe(false); // Explicitly capped at 2 when maxTier=2

    // Can upgrade all the way to CONFIG.MAX_TIER (9)
    cannon.setTier(CONFIG.MAX_TIER);
    expect(cannon.upgradeTier()).toBe(false); // Max tier capped at 9
    cannon.setTier(2);

    // Fire at count 3, tier 2: fires 3 shots with tier 2 stats (hp 2, dmg 2)
    const prevCountT2 = pool.count;
    cannon.update(0.2, pool, rng);
    expect(pool.count - prevCountT2).toBe(3);
    for (let i = prevCountT2; i < prevCountT2 + 3; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.tier[slot]).toBe(2);
      expect(pool.hp[slot]).toBe(2);
      expect(pool.damage[slot]).toBe(2);
    }
  });

  it('collects LV+1 pickup on blue mob collision and upgrades cannon', async () => {
    const cannon = new CannonSim();
    const pool = createMobPool(10);
    const { PickupManager } = await import('../../src/sim/pickups');
    const manager = new PickupManager([
      {
        id: 201,
        kind: 'upgrade',
        x: 0,
        z: 20,
        radius: 1.5
      }
    ]);

    expect(cannon.tier).toBe(0);
    expect(manager.pickups[0].isCollected).toBe(false);

    // Spawn blue unit at pickup location
    const { spawnMob } = await import('../../src/sim/pool');
    spawnMob(pool, 0, 20.2, 0, 10, 0);

    manager.update(pool, cannon);

    expect(manager.pickups[0].isCollected).toBe(true);
    expect(manager.justCollectedUpgrade).toBe(true);
    expect(cannon.tier).toBe(1);
  });
});
