import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';
import { spawnMob } from '../../src/sim/pool';

describe('Fixed-Timestep Simulation Loop', () => {
  it('moves mobs forward along +Z at MOB_BASE_SPEED', () => {
    const sim = new Simulation(1234);

    const slot = spawnMob(sim.pool, 0, 10, 0, CONFIG.MOB_BASE_SPEED, 0);

    const initialZ = sim.pool.z[slot];
    // Step exactly 1.0 second (60 ticks of 1/60s)
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }

    const expectedZ = initialZ + CONFIG.MOB_BASE_SPEED * 1.0;
    expect(sim.pool.z[slot]).toBeCloseTo(expectedZ, 3);
  });

  it('despawns mobs when crossing past MOB_MAX_Z in normal mode', () => {
    const sim = new Simulation(1234);
    // Pause cannon firing during this test to isolate despawning behavior
    sim.cannon.fireInterval = 9999;

    const slot = spawnMob(sim.pool, 0, CONFIG.MOB_MAX_Z - 0.5, 0, 10, 0);

    expect(sim.pool.count).toBe(1);

    // Step 0.2s: moves 2 units past MOB_MAX_Z
    sim.step(0.2);

    expect(sim.pool.active[slot]).toBe(0);
    expect(sim.pool.count).toBe(0);
    expect(sim.pool.lastGateId[slot]).toBe(-1);
  });

  it('is bit-for-bit deterministic across two independent runs with same seed', () => {
    const sim1 = new Simulation(999);
    const sim2 = new Simulation(999);

    for (let i = 0; i < 180; i++) {
      sim1.step(1 / 60);
      sim2.step(1 / 60);
    }

    expect(sim1.pool.count).toBe(sim2.pool.count);
    expect(sim1.cannon.x).toBe(sim2.cannon.x);

    for (let i = 0; i < sim1.pool.count; i++) {
      const s1 = sim1.pool.activeIndices[i];
      const s2 = sim2.pool.activeIndices[i];
      expect(sim1.pool.x[s1]).toBe(sim2.pool.x[s2]);
      expect(sim1.pool.z[s1]).toBe(sim2.pool.z[s2]);
    }
  });

  it('resolves base breaches and Game Over in the simulation loop', () => {
    const sim = new Simulation(42);
    sim.cannon.fireInterval = 9999; // isolate from cannon

    // Spawn 10 enemy red units right at the base line with weight 10 each = 100 damage
    for (let i = 0; i < 10; i++) {
      spawnMob(sim.pool, 0, 0.1, 0, -5, 1, 0, 1, 1, 10);
    }

    expect(sim.base.hp).toBe(100);
    expect(sim.base.isGameOver).toBe(false);

    // Step 1 tick (moves Z past 0)
    sim.step(1 / 60);

    expect(sim.base.hp).toBe(0);
    expect(sim.base.isGameOver).toBe(true);

    // Subsequent steps freeze simulation
    const cannonXBefore = sim.cannon.x;
    sim.step(1 / 60);
    expect(sim.cannon.x).toBe(cannonXBefore);
  });

  it('is bit-for-bit identical after restart() compared to a fresh run', () => {
    const seed = 777;
    const simFresh = new Simulation(seed);
    const simRestarted = new Simulation(seed);

    // Run simRestarted for 120 ticks, then damage base
    for (let i = 0; i < 120; i++) {
      simRestarted.step(1 / 60);
    }
    simRestarted.base.takeDamage(50);

    // Restart simRestarted
    simRestarted.restart(seed);

    // Step both for 180 ticks
    for (let i = 0; i < 180; i++) {
      simFresh.step(1 / 60);
      simRestarted.step(1 / 60);
    }

    expect(simRestarted.base.hp).toBe(simFresh.base.hp);
    expect(simRestarted.cannon.x).toBe(simFresh.cannon.x);
    expect(simRestarted.pool.count).toBe(simFresh.pool.count);

    for (let i = 0; i < simFresh.pool.count; i++) {
      const sFresh = simFresh.pool.activeIndices[i];
      const sRestart = simRestarted.pool.activeIndices[i];
      expect(simRestarted.pool.x[sRestart]).toBe(simFresh.pool.x[sFresh]);
      expect(simRestarted.pool.z[sRestart]).toBe(simFresh.pool.z[sFresh]);
      expect(simRestarted.pool.weight[sRestart]).toBe(simFresh.pool.weight[sFresh]);
    }
  });
});
