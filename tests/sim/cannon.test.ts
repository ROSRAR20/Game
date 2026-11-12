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
    }
  });
});
