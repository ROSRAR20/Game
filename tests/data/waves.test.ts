import { describe, it, expect } from 'vitest';
import { validateWaves, getLevel1Waves } from '../../src/data/waves';
import { WaveManager } from '../../src/sim/waves';
import { createMobPool } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';
import { CONFIG } from '../../src/config/constants';

describe('Wave Data & Zod Validation', () => {
  it('validates bundled Level 1 waves without error', () => {
    const waves = getLevel1Waves();
    expect(waves.length).toBeGreaterThan(0);
    expect(waves[0].id).toBe(1);
    expect(waves[0].triggerTimeSec).toBe(2.0);
  });

  it('rejects wave item if minX > maxX', () => {
    const invalidWave = [
      {
        id: 1,
        triggerTimeSec: 1.0,
        count: 5,
        minX: 2.0,
        maxX: -1.0, // invalid: minX > maxX
        spawnZ: 50.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      }
    ];

    expect(() => validateWaves(invalidWave)).toThrow(/minX must be <= maxX/);
  });

  it('rejects wave item if coordinates exceed road boundaries', () => {
    const outOfBoundsLeft = [
      {
        id: 1,
        triggerTimeSec: 1.0,
        count: 5,
        minX: CONFIG.ROAD_X_MIN - 1.0,
        maxX: 0,
        spawnZ: 50.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      }
    ];

    expect(() => validateWaves(outOfBoundsLeft)).toThrow();

    const outOfBoundsZ = [
      {
        id: 1,
        triggerTimeSec: 1.0,
        count: 5,
        minX: -2.0,
        maxX: 2.0,
        spawnZ: CONFIG.WAVES.SPAWN_Z_MAX + 10.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      }
    ];

    expect(() => validateWaves(outOfBoundsZ)).toThrow();
  });

  it('rejects duplicate wave IDs', () => {
    const duplicateIds = [
      {
        id: 1,
        triggerTimeSec: 1.0,
        count: 5,
        minX: -2.0,
        maxX: 2.0,
        spawnZ: 50.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      },
      {
        id: 1, // duplicate id
        triggerTimeSec: 2.0,
        count: 5,
        minX: -2.0,
        maxX: 2.0,
        spawnZ: 50.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      }
    ];

    expect(() => validateWaves(duplicateIds)).toThrow(/Wave IDs must be unique/);
  });

  it('rejects non-ascending triggerTimeSec', () => {
    const nonAscending = [
      {
        id: 1,
        triggerTimeSec: 5.0,
        count: 5,
        minX: -2.0,
        maxX: 2.0,
        spawnZ: 50.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      },
      {
        id: 2,
        triggerTimeSec: 3.0, // earlier than wave 1
        count: 5,
        minX: -2.0,
        maxX: 2.0,
        spawnZ: 50.0,
        speed: 2.5,
        weight: 1,
        tier: 0
      }
    ];

    expect(() => validateWaves(nonAscending)).toThrow(/triggerTimeSec must be ascending/);
  });

  it('rejects speeds higher than CONFIG.WAVES.MAX_SPEED', () => {
    const overspeed = [
      {
        id: 1,
        triggerTimeSec: 1.0,
        count: 5,
        minX: -2.0,
        maxX: 2.0,
        spawnZ: 50.0,
        speed: CONFIG.WAVES.MAX_SPEED + 1.0,
        weight: 1,
        tier: 0
      }
    ];

    expect(() => validateWaves(overspeed)).toThrow();
  });
});

describe('WaveManager Simulation Logic', () => {
  it('spawns red units deterministically when triggerTimeSec is reached', () => {
    const waves = [
      {
        id: 1,
        triggerTimeSec: 1.0,
        count: 10,
        minX: -3.0,
        maxX: 3.0,
        spawnZ: 40.0,
        speed: 2.0,
        weight: 2,
        tier: 1
      }
    ];

    const manager = new WaveManager(waves);
    const pool = createMobPool(100);
    const rng = new SeededRNG(42);

    // Step 0.5s: wave should not spawn yet
    manager.update(0.5, pool, rng);
    expect(pool.count).toBe(0);
    expect(manager.isAllWavesSpawned()).toBe(false);

    // Step another 0.6s (total 1.1s): wave triggers!
    manager.update(0.6, pool, rng);
    expect(pool.count).toBe(10);
    expect(manager.isAllWavesSpawned()).toBe(true);

    // Verify all spawned mobs are Team 1 (Red) with negative vz
    for (let i = 0; i < pool.count; i++) {
      const slot = pool.activeIndices[i];
      expect(pool.team[slot]).toBe(1); // Red team
      expect(pool.vz[slot]).toBe(-2.0); // Negative Z movement
      expect(pool.weight[slot]).toBe(2);
      expect(pool.tier[slot]).toBe(1);
      expect(pool.x[slot]).toBeGreaterThanOrEqual(-3.0);
      expect(pool.x[slot]).toBeLessThanOrEqual(3.0);
      expect(pool.z[slot]).toBeGreaterThanOrEqual(40.0);
    }
  });

  it('resets wave progression cleanly on reset()', () => {
    const waves = [
      {
        id: 1,
        triggerTimeSec: 0.5,
        count: 5,
        minX: -1.0,
        maxX: 1.0,
        spawnZ: 30.0,
        speed: 2.0,
        weight: 1,
        tier: 0
      }
    ];

    const manager = new WaveManager(waves);
    const pool = createMobPool(100);
    const rng = new SeededRNG(123);

    manager.update(0.6, pool, rng);
    expect(pool.count).toBe(5);

    manager.reset();
    expect(manager.elapsedSec).toBe(0);
    expect(manager.currentWaveIdx).toBe(0);
    expect(manager.isAllWavesSpawned()).toBe(false);
  });
});
