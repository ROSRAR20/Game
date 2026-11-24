import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { EndlessManager, DEFAULT_ENDLESS_CONFIG } from '../../src/sim/endless';
import { CONFIG } from '../../src/config/constants';

describe('Endless Run Simulation & Difficulty Curves', () => {
  it('scales spawn rate and speed as pure functions of run time', () => {
    const endless = new EndlessManager(42);

    // At t = 0
    expect(endless.getSpawnRate(0)).toBeCloseTo(3.2, 2);
    expect(endless.getUnitSpeed(0)).toBeCloseTo(2.7, 2);

    // At t = 60s (1 min)
    expect(endless.getSpawnRate(60)).toBeCloseTo(6.2, 2);
    expect(endless.getUnitSpeed(60)).toBeCloseTo(2.8, 2);

    // At t = 180s (3 min)
    expect(endless.getSpawnRate(180)).toBeCloseTo(12.2, 2);
    expect(endless.getUnitSpeed(180)).toBeCloseTo(3.0, 2);

    // At t = 360s (6 min)
    expect(endless.getSpawnRate(360)).toBeCloseTo(21.2, 2);

    // At t = 600s (10 min)
    expect(endless.getSpawnRate(600)).toBe(DEFAULT_ENDLESS_CONFIG.maxSpawnRate);

    // Beyond max cap (e.g. 15 min): capped at maxSpawnRate (22.0) and maxSpeed (3.6)
    expect(endless.getSpawnRate(900)).toBe(DEFAULT_ENDLESS_CONFIG.maxSpawnRate);
    expect(endless.getUnitSpeed(9000)).toBe(DEFAULT_ENDLESS_CONFIG.maxSpeed);
  });

  it('calculates score from survival SECONDS (ticks/60) + kills (Amendment 1)', () => {
    const endless = new EndlessManager(42);
    endless.kills = 25;

    // 120 seconds = 7,200 ticks
    const score = endless.getScore(7200);
    // score = 120 seconds + 25 * 10 = 370
    expect(score).toBe(120 + 250);
  });

  it('spawns red units strictly within centre lane corridor and far half (never tunnels)', () => {
    const sim = new Simulation(42);
    sim.startEndless(0);

    // Step for 10 seconds (600 ticks)
    for (let i = 0; i < 600; i++) {
      sim.step(CONFIG.FIXED_DELTA_TIME);
    }

    let redFound = 0;
    for (let i = 0; i < sim.pool.count; i++) {
      const slot = sim.pool.activeIndices[i];
      if (sim.pool.team[slot] === 1) {
        redFound++;
        // Must spawn and stay within road bounds; initial X spawn within [-1.75, 1.75]
        expect(sim.pool.x[slot]).toBeGreaterThanOrEqual(CONFIG.ROAD_X_MIN);
        expect(sim.pool.x[slot]).toBeLessThanOrEqual(CONFIG.ROAD_X_MAX);
        expect(sim.pool.vz[slot]).toBeLessThan(0); // moves toward base
      }
    }
    expect(redFound).toBeGreaterThan(0);
  });

  it('supports ?startAt=SECONDS setting difficulty clock directly without fast-forwarding sim (Amendment 2)', () => {
    const sim = new Simulation(42);
    // Start directly at 5 minutes (300 seconds)
    sim.startEndless(300);

    expect(sim.endless.difficultyTime).toBe(300);
    expect(sim.base.hp).toBe(CONFIG.BASE_MAX_HP); // Full base HP (no damage suffered)
    expect(sim.ticks).toBe(300 * 60);

    // Initial spawn rate should immediately reflect minute 5 difficulty
    const rateAt300 = sim.endless.getSpawnRate(sim.endless.difficultyTime);
    expect(rateAt300).toBeGreaterThan(7.0);

    // Spawning immediately reflects mid/late game tier progression
    sim.step(CONFIG.FIXED_DELTA_TIME);
    expect(sim.base.hp).toBe(100);
  });

  it('supports cannonCount presets and Model 1 one-shot-per-shooter formation', () => {
    const sim = new Simulation(42);
    sim.startEndless(0);
    sim.cannon.setCannonCount(4); // 4 shooters
    sim.cannon.setTier(1); // Tier 1 shooters

    expect(sim.cannon.cannonCount).toBe(4);
    expect(sim.cannon.tier).toBe(1);

    // Fire 1 volley
    sim.cannon.update(0.2, sim.pool, sim.rng);
    expect(sim.pool.count).toBe(4); // Exactly 4 units (1 per shooter)

    for (let i = 0; i < 4; i++) {
      const slot = sim.pool.activeIndices[i];
      expect(sim.pool.tier[slot]).toBe(1);
      expect(sim.pool.hp[slot]).toBe(2);
      expect(sim.pool.damage[slot]).toBe(1);
    }
  });
});
