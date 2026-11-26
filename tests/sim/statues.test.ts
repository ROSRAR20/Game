import { describe, it, expect } from 'vitest';
import { StatueQueueManager, getStatueMaxHp, getStatueRewardKind } from '../../src/sim/statues';
import { CannonSim } from '../../src/sim/cannon';
import { createMobPool, spawnMob } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';
import { CONFIG } from '../../src/config/constants';

describe('Stage 6: 10-Tier Progression, Steeper Statue HP & Overdrive', () => {
  it('defines quadratic Statue K HP formula (27*K + 15*(K-1)^2) and takes 4.5s for Statue 1 at Tier 0 Count 1', () => {
    const expectedHps = [27, 69, 141, 243, 375, 537, 729, 951, 1203, 1485];
    for (let k = 1; k <= 10; k++) {
      expect(getStatueMaxHp(k)).toBe(expectedHps[k - 1]);
    }

    // Simulate sustained fire from Tier 0, Count 1 cannon aimed at Statue 1 (X = -4.0)
    const queue = new StatueQueueManager();
    const cannon = new CannonSim();
    const pool = createMobPool(200);
    const rng = new SeededRNG(42);
    cannon.x = CONFIG.STATUES.LANE_X;
    cannon.targetX = CONFIG.STATUES.LANE_X;

    let elapsedSec = 0;
    const dt = CONFIG.FIXED_DELTA_TIME;
    let destroyed = false;

    for (let tick = 0; tick < 60 * 10; tick++) {
      elapsedSec += dt;
      cannon.update(dt, pool, rng);
      for (let i = 0; i < pool.count; i++) {
        const slot = pool.activeIndices[i];
        pool.z[slot] += pool.vz[slot] * dt;
      }
      const res = queue.update(dt, pool, cannon);
      if (res.destroyedStatue) {
        destroyed = true;
        break;
      }
    }

    expect(destroyed).toBe(true);
    expect(elapsedSec).toBeGreaterThanOrEqual(4.5);
    expect(elapsedSec).toBeLessThanOrEqual(5.5);
  });

  it('makes ONLY Slot 1 hittable while Slots 2 and 3 ignore projectiles', () => {
    const queue = new StatueQueueManager();
    const cannon = new CannonSim();
    const pool = createMobPool(50);

    expect(queue.statues[0].isHittable).toBe(true);
    expect(queue.statues[1].isHittable).toBe(false);
    expect(queue.statues[2].isHittable).toBe(false);

    spawnMob(pool, CONFIG.STATUES.LANE_X, CONFIG.STATUES.SLOT_Z[1], 0, 0, 0, 0, 1, 10, 1);
    spawnMob(pool, CONFIG.STATUES.LANE_X, CONFIG.STATUES.SLOT_Z[2], 0, 0, 0, 0, 1, 10, 1);

    queue.update(1 / 60, pool, cannon);

    expect(queue.statues[1].hp).toBe(69);
    expect(queue.statues[2].hp).toBe(141);
    expect(pool.count).toBe(2);
  });

  it('unlocks Tiers 1..9 from Statues 1..9 and grants 15s Overdrive from Statue 10+', () => {
    const queue = new StatueQueueManager();
    const cannon = new CannonSim();
    const pool = createMobPool(50);

    for (let k = 1; k <= 9; k++) {
      expect(getStatueRewardKind(k)).toBe('tier');
    }
    expect(getStatueRewardKind(10)).toBe('overdrive');
    expect(getStatueRewardKind(11)).toBe('overdrive');

    for (let k = 1; k <= 9; k++) {
      const hp = getStatueMaxHp(k);
      spawnMob(pool, CONFIG.STATUES.LANE_X, CONFIG.STATUES.SLOT_Z[0], 0, 0, 0, 0, 1, hp, 1);
      const res = queue.update(1 / 60, pool, cannon);
      expect(res.rewardGranted).toBe('tier');
      expect(res.rewardTier).toBe(k);
      expect(res.scoreAwarded).toBe(250);
      expect(cannon.tier).toBe(k);

      // Slide next statue into Slot 1
      for (let t = 0; t < 66; t++) {
        queue.update(1 / 60, pool, cannon);
      }
    }

    // Statue 10 -> 15s Overdrive + 1000 score
    const hp10 = getStatueMaxHp(10);
    spawnMob(pool, CONFIG.STATUES.LANE_X, CONFIG.STATUES.SLOT_Z[0], 0, 0, 0, 0, 1, hp10, 1);
    const res10 = queue.update(1 / 60, pool, cannon);
    expect(res10.rewardGranted).toBe('overdrive');
    expect(res10.scoreAwarded).toBe(1000);
    expect(cannon.overdriveTimer).toBeCloseTo(15.0, 2);
  });

  it('refreshes Overdrive duration to 15s without stacking duration or fire-rate multiplier', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(100);
    const rng = new SeededRNG(42);

    cannon.activateOverdrive();
    expect(cannon.overdriveTimer).toBe(15.0);
    expect(cannon.fireInterval).toBeCloseTo(1 / 9, 4);

    for (let i = 0; i < 600; i++) {
      cannon.update(1 / 60, pool, rng);
    }
    expect(cannon.overdriveTimer).toBeCloseTo(5.0, 1);

    cannon.activateOverdrive();
    expect(cannon.overdriveTimer).toBe(15.0);
    expect(cannon.fireInterval).toBeCloseTo(1 / 9, 4);

    for (let i = 0; i < 901; i++) {
      cannon.update(1 / 60, pool, rng);
    }
    expect(cannon.overdriveTimer).toBe(0);
    expect(cannon.fireInterval).toBeCloseTo(1 / 6, 4);
  });

  it('defines all 10 tiers (0..9) explicitly in CONFIG.TIERS with increasing combat power', () => {
    let prevPower = 0;
    for (let t = 0; t <= CONFIG.MAX_TIER; t++) {
      const cfg = CONFIG.TIERS[t];
      expect(cfg).toBeDefined();
      expect(cfg.hp).toBeGreaterThanOrEqual(1);
      expect(cfg.damage).toBeGreaterThanOrEqual(1);
      expect(cfg.weight).toBe(1);
      const power = cfg.hp * cfg.damage * cfg.weight;
      expect(power).toBeGreaterThan(prevPower);
      prevPower = power;
    }
  });
});
