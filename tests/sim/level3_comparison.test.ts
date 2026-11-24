import { describe, it } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';

describe('Level 1 vs Level 3 Performance & Departure Tuning (Option 1)', () => {
  it('measures Level 1 vs Level 3 clear time, peak units, and base HP lost for Tier 0, 1, 2', () => {
    const numSeeds = 30;
    const seeds = Array.from({ length: numSeeds }, (_, i) => i + 1);

    const runLevel = (levelId: number, tier: number) => {
      const results = seeds.map((seed) => {
        const sim = new Simulation(seed);
        sim.loadLevel(levelId);
        sim.cannon.setTierOption('option1');
        sim.cannon.setTier(tier);
        sim.cannon.x = 0;
        sim.cannon.setTargetX(0);

        let peakUnits = 0;
        let clearTime = -1;
        const maxTicks = 45 * 60;

        for (let tick = 0; tick < maxTicks; tick++) {
          sim.step(CONFIG.FIXED_DELTA_TIME);
          if (sim.pool.count > peakUnits) peakUnits = sim.pool.count;
          if (sim.isGameWon && clearTime === -1) clearTime = tick / 60;
          if (sim.base.isGameOver) break;
        }

        const hpLost = Math.round(CONFIG.BASE_MAX_HP - sim.base.hp);
        return {
          won: sim.isGameWon,
          clearTime: clearTime > 0 ? clearTime : 45.0,
          hpLost,
          peakUnits
        };
      });

      const n = results.length;
      const clears = results.map((r) => r.clearTime);
      const hps = results.map((r) => r.hpLost);
      const peaks = results.map((r) => r.peakUnits);

      const meanClear = (clears.reduce((a, b) => a + b, 0) / n).toFixed(1);
      const minClear = Math.min(...clears).toFixed(1);
      const maxClear = Math.max(...clears).toFixed(1);

      const meanHp = (hps.reduce((a, b) => a + b, 0) / n).toFixed(1);
      const minHp = Math.min(...hps);
      const maxHp = Math.max(...hps);

      const meanPeak = Math.round(peaks.reduce((a, b) => a + b, 0) / n);

      return {
        level: `Level ${levelId}`,
        tier: `Tier ${tier}`,
        clearTime: `${meanClear}s (${minClear}–${maxClear}s)`,
        hpLost: `${meanHp} (${minHp}–${maxHp})`,
        peakUnits: meanPeak
      };
    };

    console.log('\n=== LEVEL 1 vs LEVEL 3 PERFORMANCE (Option 1, 30 Seeds) ===');
    const table = [
      runLevel(1, 0),
      runLevel(1, 1),
      runLevel(1, 2),
      runLevel(3, 0),
      runLevel(3, 1),
      runLevel(3, 2)
    ];
    console.table(table);
  });
});