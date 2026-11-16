import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { despawnMob } from '../../src/sim/pool';

describe('Win Condition & Level Flow (M4)', () => {
  it('triggers isGameWon when all objectives are destroyed and waves cleared', () => {
    const sim = new Simulation(123);
    sim.cannon.fireInterval = 9999; // isolate

    expect(sim.isGameWon).toBe(false);

    // 1. Destroy all towers
    for (const t of sim.towers.towers) {
      t.hp = 0;
      t.isDestroyed = true;
    }
    expect(sim.towers.isAllTowersDestroyed()).toBe(true);

    // 2. Defeat all bosses
    for (const b of sim.bosses.bosses) {
      b.hp = 0;
      b.isDefeated = true;
    }
    expect(sim.bosses.isAllBossesDefeated()).toBe(true);

    // 3. Mark all waves spawned
    sim.waves.currentWaveIdx = sim.waves.waves.length;
    expect(sim.waves.isAllWavesSpawned()).toBe(true);

    // 4. Clear any red mobs from pool
    for (let i = sim.pool.count - 1; i >= 0; i--) {
      const slot = sim.pool.activeIndices[i];
      if (sim.pool.team[slot] === 1) {
        despawnMob(sim.pool, slot);
      }
    }

    // Step 1 tick to evaluate win condition
    sim.step(1 / 60);

    expect(sim.isGameWon).toBe(true);
    expect(sim.base.isGameOver).toBe(false);

    // Subsequent steps freeze simulation
    const cannonX = sim.cannon.x;
    sim.step(1 / 60);
    expect(sim.cannon.x).toBe(cannonX);

    // Restart resets win condition
    sim.restart();
    expect(sim.isGameWon).toBe(false);
    expect(sim.towers.isAllTowersDestroyed()).toBe(false);
    expect(sim.bosses.isAllBossesDefeated()).toBe(false);
  });
});
