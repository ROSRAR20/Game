import { describe, it, expect } from 'vitest';
import { TowerManager } from '../../src/sim/towers';
import { BossManager } from '../../src/sim/boss';
import { BaseDefense } from '../../src/sim/base';
import { createMobPool, spawnMob } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';

describe('Guardian Towers & Boss Simulation (M4)', () => {
  it('damages tower when blue mobs collide and despawns the attacker', () => {
    const manager = new TowerManager([
      {
        id: 1,
        x: 0,
        z: 30,
        radius: 1.0,
        maxHp: 20,
        rewardType: 'burst_units',
        rewardValue: 10
      }
    ]);

    const pool = createMobPool(100);
    const rng = new SeededRNG(42);

    // Spawn 5 blue mobs right at tower location with weight 2 each = 10 total damage
    for (let i = 0; i < 5; i++) {
      spawnMob(pool, 0, 30.2, 0, 10, 0, 0, 1, 1, 2);
    }
    expect(pool.count).toBe(5);

    manager.update(pool, rng);

    expect(manager.towers[0].hp).toBe(10); // 20 - (5 * 2) = 10
    expect(manager.towers[0].isDestroyed).toBe(false);
    expect(pool.count).toBe(0); // All 5 mobs sacrificed
  });

  it('destroys tower at 0 HP and spawns reward burst units', () => {
    const manager = new TowerManager([
      {
        id: 1,
        x: 0,
        z: 30,
        radius: 1.0,
        maxHp: 10,
        rewardType: 'burst_units',
        rewardValue: 15
      }
    ]);

    const pool = createMobPool(100);
    const rng = new SeededRNG(99);

    // Spawn 10 blue mobs of weight 1 = 10 damage -> destroys tower
    for (let i = 0; i < 10; i++) {
      spawnMob(pool, 0, 30.1, 0, 10, 0, 0, 1, 1, 1);
    }

    manager.update(pool, rng);

    expect(manager.towers[0].hp).toBe(0);
    expect(manager.towers[0].isDestroyed).toBe(true);
    expect(manager.isAllTowersDestroyed()).toBe(true);

    // Reward burst should spawn exactly 15 blue units
    expect(pool.count).toBe(15);
    for (let i = 0; i < pool.count; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.team[slot]).toBe(0); // Blue team
      expect(pool.z[slot]).toBeGreaterThanOrEqual(30.0);
    }
  });

  it('damages boss on blue mob contact and detects defeat', () => {
    const manager = new BossManager([
      {
        id: 101,
        x: 0,
        z: 50,
        radius: 2.0,
        maxHp: 50,
        damage: 40,
        speed: 1.0
      }
    ]);

    const pool = createMobPool(100);
    const base = new BaseDefense(100);

    // Spawn 10 blue units of weight 3 at boss location = 30 damage
    for (let i = 0; i < 10; i++) {
      spawnMob(pool, 0, 50.5, 0, 10, 0, 0, 1, 1, 3);
    }

    manager.update(0.1, pool, base);

    expect(manager.bosses[0].hp).toBe(20); // 50 - 30 = 20
    expect(manager.bosses[0].isDefeated).toBe(false);
    expect(manager.isAllBossesDefeated()).toBe(false);

    // Spawn 7 more blue units of weight 3 = 21 damage -> defeats boss
    for (let i = 0; i < 7; i++) {
      spawnMob(pool, 0, 50.4, 0, 10, 0, 0, 1, 1, 3);
    }

    manager.update(0.1, pool, base);
    expect(manager.bosses[0].hp).toBe(0);
    expect(manager.bosses[0].isDefeated).toBe(true);
    expect(manager.isAllBossesDefeated()).toBe(true);
  });

  it('inflicts massive base damage if boss breaches base line (Z <= 0)', () => {
    const manager = new BossManager([
      {
        id: 101,
        x: 0,
        z: 0.05,
        radius: 2.0,
        maxHp: 500,
        damage: 60,
        speed: 5.0
      }
    ]);

    const pool = createMobPool(10);
    const base = new BaseDefense(100);

    // 1 tick of dt = 1/60s moves boss Z by -5 * (1/60) = -0.0833 -> Z becomes negative
    manager.update(1 / 60, pool, base);

    expect(base.hp).toBe(40); // 100 - 60 = 40
    expect(manager.bosses[0].isDefeated).toBe(true);
  });
});
