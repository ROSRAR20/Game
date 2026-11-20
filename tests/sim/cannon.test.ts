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

  it('upgrades tier and spawns upgraded stats (Tier 1 & Tier 2)', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(20);
    const rng = new SeededRNG(42);

    expect(cannon.tier).toBe(0);
    expect(cannon.upgradeTier()).toBe(true);
    expect(cannon.tier).toBe(1);

    // Fire at tier 1
    cannon.update(0.2, pool, rng);
    expect(pool.count).toBeGreaterThan(0);
    const slotT1 = pool.activeIndices[0];
    expect(pool.tier[slotT1]).toBe(1);
    expect(pool.hp[slotT1]).toBe(2);
    expect(pool.damage[slotT1]).toBe(2);

    // Upgrade to tier 2
    expect(cannon.upgradeTier()).toBe(true);
    expect(cannon.tier).toBe(2);
    expect(cannon.upgradeTier()).toBe(false); // Max tier capped at 2

    // Fire at tier 2 (cadence 4 volleys/s -> interval 0.25s)
    const prevCount = pool.count;
    cannon.update(0.26, pool, rng);
    const slotT2 = pool.activeIndices[prevCount];
    expect(pool.tier[slotT2]).toBe(2);
    expect(pool.hp[slotT2]).toBe(4);
    expect(pool.damage[slotT2]).toBe(3);
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
