import { describe, it, expect } from 'vitest';
import { TowerManager } from '../../src/sim/towers';
import { CannonSim } from '../../src/sim/cannon';
import { createMobPool, spawnMob, despawnMob } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';
import { Simulation } from '../../src/sim/loop';

describe('Upgrade Crate Simulation & Rules', () => {
  it('breaks after exactly 5 weight-1 hits and upgrades cannon tier', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(20);
    const rng = new SeededRNG(42);

    const crateData = {
      id: 11,
      x: -4.5,
      z: 12.0,
      radius: 0.8,
      maxHp: 5,
      rewardType: 'upgrade' as const,
      rewardValue: 25
    };

    const towers = new TowerManager([crateData]);
    expect(towers.towers[0].hp).toBe(5);
    expect(towers.towers[0].isDestroyed).toBe(false);
    expect(cannon.tier).toBe(0);

    // 1. Spawn 4 single weight-1 blue mobs at crate position
    for (let i = 0; i < 4; i++) {
      spawnMob(pool, -4.5, 12.0, 0, 0, 0, 0, 1, 1, 1, -1);
    }
    expect(pool.count).toBe(4);

    towers.update(pool, rng, cannon);
    expect(towers.towers[0].hp).toBe(1);
    expect(towers.towers[0].isDestroyed).toBe(false);
    expect(cannon.tier).toBe(0);
    expect(towers.justUpgradedTier).toBe(false);
    expect(pool.count).toBe(0); // All 4 despawned on hit

    // 2. Spawn 5th mob -> breaks crate
    spawnMob(pool, -4.5, 12.0, 0, 0, 0, 0, 1, 1, 1, -1);
    towers.update(pool, rng, cannon);

    expect(towers.towers[0].hp).toBe(0);
    expect(towers.towers[0].isDestroyed).toBe(true);
    expect(cannon.tier).toBe(1);
    expect(towers.justUpgradedTier).toBe(true);
    expect(towers.justDestroyedTower).toBe(true);
  });

  it('applies upgrade exactly once even with an overkill volley in a single frame', () => {
    const cannon = new CannonSim();
    const pool = createMobPool(30);
    const rng = new SeededRNG(42);

    const crateData = {
      id: 11,
      x: -4.5,
      z: 12.0,
      radius: 0.8,
      maxHp: 5,
      rewardType: 'upgrade' as const,
      rewardValue: 25
    };

    const towers = new TowerManager([crateData]);
    expect(cannon.tier).toBe(0);

    // Spawn 15 units all overlapping the crate at once (overkill)
    for (let i = 0; i < 15; i++) {
      spawnMob(pool, -4.5, 12.0, 0, 0, 0, 0, 1, 1, 1, -1);
    }

    towers.update(pool, rng, cannon);

    // Tier must become 1 (NOT 2)
    expect(cannon.tier).toBe(1);
    expect(towers.towers[0].isDestroyed).toBe(true);
    expect(towers.towers[0].hp).toBe(0);

    // Subsequent updates must never trigger another upgrade
    towers.update(pool, rng, cannon);
    expect(cannon.tier).toBe(1);
  });

  it('triggers approved max-tier fallback (spawning 25 units) when already at Tier 2', () => {
    const cannon = new CannonSim();
    cannon.tier = 2; // already max tier
    const pool = createMobPool(50);
    const rng = new SeededRNG(42);

    const crateData = {
      id: 11,
      x: -4.5,
      z: 12.0,
      radius: 0.8,
      maxHp: 5,
      rewardType: 'upgrade' as const,
      rewardValue: 25
    };

    const towers = new TowerManager([crateData]);

    // Spawn 5 units to break crate
    for (let i = 0; i < 5; i++) {
      spawnMob(pool, -4.5, 12.0, 0, 0, 0, 0, 1, 1, 1, -1);
    }

    towers.update(pool, rng, cannon);

    expect(towers.towers[0].isDestroyed).toBe(true);
    expect(cannon.tier).toBe(2); // remains 2
    expect(towers.justUpgradedTier).toBe(false); // didn't upgrade tier

    // 25 reward units spawned
    expect(pool.count).toBe(25);
  });

  it('crate is optional and not counted for level victory condition', () => {
    const sim = new Simulation(1);
    sim.cannon.fireInterval = 9999;

    expect(sim.isGameWon).toBe(false);

    // Regular towers destroyed (Tower 1 at Z=30)
    for (const t of sim.towers.towers) {
      if (t.rewardType !== 'upgrade') {
        t.hp = 0;
        t.isDestroyed = true;
      }
    }
    // Crate is NOT destroyed
    const crate = sim.towers.towers.find((t) => t.rewardType === 'upgrade');
    expect(crate).toBeDefined();
    expect(crate?.isDestroyed).toBe(false);

    // Defeat all bosses
    for (const b of sim.bosses.bosses) {
      b.hp = 0;
      b.isDefeated = true;
    }

    // Clear waves
    sim.waves.currentWaveIdx = sim.waves.waves.length;
    for (let i = sim.pool.count - 1; i >= 0; i--) {
      const slot = sim.pool.activeIndices[i];
      if (sim.pool.team[slot] === 1) {
        despawnMob(sim.pool, slot);
      }
    }

    // Step 1 tick
    sim.step(1 / 60);

    // Level won even with crate completely intact!
    expect(sim.isGameWon).toBe(true);
  });

  it('crate-only level does not win instantly on tick 0 or without objectives', () => {
    const sim = new Simulation(1);

    // Remove all required towers, bosses, and waves, leaving ONLY the upgrade crate
    sim.towers.towers = sim.towers.towers.filter((t) => t.rewardType === 'upgrade');
    sim.bosses.bosses = [];
    sim.waves.waves = [];
    sim.waves.currentWaveIdx = 0;

    expect(sim.towers.hasRequiredTowers()).toBe(false);
    expect(sim.towers.isAllTowersDestroyed()).toBe(true);

    sim.step(1 / 60);

    // Must NOT win instantly because no victory objectives exist!
    expect(sim.isGameWon).toBe(false);
  });
});
