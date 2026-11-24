import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';
import { createGate } from '../../src/sim/gates';

describe('Headless Prototype & 30-Seed Balance Suite', () => {
  it('verifies crate-only level does not win instantly (isAllTowersDestroyed excludes upgrade towers)', () => {
    const sim = new Simulation(42);
    sim.loadLevel(1);

    // Set towers to only contain upgrade crate and statue (no objective towers)
    sim.towers.setTowers([
      {
        id: 301,
        x: 4.0,
        z: 8.0,
        radius: 1.2,
        maxHp: 5,
        rewardType: 'upgrade',
        rewardValue: 1
      },
      {
        id: 302,
        x: -4.0,
        z: 14.0,
        radius: 1.2,
        maxHp: 45,
        rewardType: 'upgrade',
        rewardValue: 2
      }
    ]);

    // Initial state: enemies still present, level must NOT be won
    sim.step(CONFIG.FIXED_DELTA_TIME);
    expect(sim.isGameWon).toBe(false);

    // Towers list has 2 upgrade items; isAllTowersDestroyed returns true since there are 0 objective towers
    expect(sim.towers.isAllTowersDestroyed()).toBe(true);
    // But win condition also requires all bosses defeated and redCount == 0
    expect(sim.bosses.isAllBossesDefeated()).toBe(false);
    expect(sim.isGameWon).toBe(false);
  });

  it('runs 30-seed simulation across Tier 0, 1, 2 at Cannon X = -4, 0, +4 for Option 1 and Option 2', () => {
    const numSeeds = 30;
    const seeds = Array.from({ length: numSeeds }, (_, i) => i + 1);

    interface RunResult {
      bossKilled: boolean;
      clearTime: number;
      baseHpLost: number;
      peakUnits: number;
    }

    const runSim = (
      seed: number,
      tier: number,
      cannonX: number,
      tierOption: 'option1' | 'option2'
    ): RunResult => {
      const sim = new Simulation(seed);
      const lvl = sim.loadLevel(1);

      // Apply Option A Gate & Wave layout:
      // Centre lane gates at Z = 18 strictly inside X in [-2.0, 2.0]
      // Left lane +1 gates at X = 4.0 (Screen Left)
      sim.gates.setGates([
        createGate(1, 'add', 5, -1.0, 2.0, 18.0), // Centre Left (+5)
        createGate(2, 'mul', 2, 1.0, 2.0, 18.0),  // Centre Right (x2)
        createGate(3, 'add', 1, 4.0, 3.6, 10.0),  // Screen Left Lane (+1)
        createGate(4, 'add', 1, 4.0, 3.6, 13.0),  // Screen Left Lane (+1)
        createGate(5, 'add', 1, 4.0, 3.6, 16.0),  // Screen Left Lane (+1)
      ]);

      // Waves confined strictly to Centre lane X in [-1.75, 1.75]
      const waves = lvl.waves.map((w) => ({
        ...w,
        minX: -1.75,
        maxX: 1.75
      }));
      sim.waves.setWaves(waves);

      sim.cannon.setTierOption(tierOption);
      sim.cannon.setTier(tier);
      sim.cannon.x = cannonX;
      sim.cannon.setTargetX(cannonX);

      const maxSec = 45.0;
      const totalTicks = Math.round(maxSec * 60);
      let peakUnits = 0;
      let clearTime = -1;

      for (let tick = 0; tick < totalTicks; tick++) {
        sim.step(CONFIG.FIXED_DELTA_TIME);

        if (sim.pool.count > peakUnits) {
          peakUnits = sim.pool.count;
        }

        if (sim.isGameWon && clearTime === -1) {
          clearTime = tick / 60;
        }

        if (sim.base.isGameOver) {
          break;
        }
      }

      const bossKilled = sim.bosses.isAllBossesDefeated();
      const baseHpLost = Math.round(CONFIG.BASE_MAX_HP - sim.base.hp);

      return {
        bossKilled,
        clearTime: clearTime > 0 ? clearTime : 45.0,
        baseHpLost,
        peakUnits
      };
    };

    const aggregateMetrics = (results: RunResult[]) => {
      const n = results.length;
      const bossKills = results.filter((r) => r.bossKilled).length;
      const bossKillPct = ((bossKills / n) * 100).toFixed(0) + '%';

      const clears = results.map((r) => r.clearTime);
      const hpLosts = results.map((r) => r.baseHpLost);
      const peaks = results.map((r) => r.peakUnits);

      const minClear = Math.min(...clears).toFixed(1);
      const maxClear = Math.max(...clears).toFixed(1);
      const meanClear = (clears.reduce((a, b) => a + b, 0) / n).toFixed(1);

      const minHpLost = Math.min(...hpLosts);
      const maxHpLost = Math.max(...hpLosts);
      const meanHpLost = (hpLosts.reduce((a, b) => a + b, 0) / n).toFixed(1);

      const minPeak = Math.min(...peaks);
      const maxPeak = Math.max(...peaks);
      const meanPeak = Math.round(peaks.reduce((a, b) => a + b, 0) / n);

      return {
        bossKillPct,
        clearTime: `${meanClear}s (${minClear}–${maxClear}s)`,
        baseHpLost: `${meanHpLost} (${minHpLost}–${maxHpLost})`,
        peakUnits: `${meanPeak} (${minPeak}–${maxPeak})`
      };
    };

    console.log('\n=============================================================');
    console.log('=== OPTION 1 (Cadence & Spread, Fixed Weight 1): 30 SEEDS ===');
    console.log('=============================================================');

    const opt1Positions = [
      { name: 'X = -4 (Screen Right)', x: -4.0 },
      { name: 'X = 0 (Center Defend)', x: 0.0 },
      { name: 'X = +4 (Screen Left)', x: 4.0 },
    ];

    const opt1Report: Record<string, unknown>[] = [];
    for (const pos of opt1Positions) {
      for (const tier of [0, 1, 2]) {
        const results = seeds.map((s) => runSim(s, tier, pos.x, 'option1'));
        const agg = aggregateMetrics(results);
        opt1Report.push({
          Position: pos.name,
          Tier: `Tier ${tier}`,
          'Boss Killed?': agg.bossKillPct,
          'Clear Time (Mean [Min–Max])': agg.clearTime,
          'Base HP Lost (Mean [Min–Max])': agg.baseHpLost,
          'Peak Units (Mean [Min–Max])': agg.peakUnits
        });
      }
    }
    console.table(opt1Report);

    console.log('\n=============================================================');
    console.log('=== OPTION 2 (Heavy Shells, Weight-Scaling): 30 SEEDS ===');
    console.log('=============================================================');

    const opt2Report: Record<string, unknown>[] = [];
    for (const pos of opt1Positions) {
      for (const tier of [0, 1, 2]) {
        const results = seeds.map((s) => runSim(s, tier, pos.x, 'option2'));
        const agg = aggregateMetrics(results);
        opt2Report.push({
          Position: pos.name,
          Tier: `Tier ${tier}`,
          'Boss Killed?': agg.bossKillPct,
          'Clear Time (Mean [Min–Max])': agg.clearTime,
          'Base HP Lost (Mean [Min–Max])': agg.baseHpLost,
          'Peak Units (Mean [Min–Max])': agg.peakUnits
        });
      }
    }
    console.table(opt2Report);
  });

  it('runs 30-seed departure curve (seconds away from Centre lane vs Base HP lost)', () => {
    const numSeeds = 30;
    const seeds = Array.from({ length: numSeeds }, (_, i) => i + 1);
    const durations = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30];

    const measureDepartureForSeed = (seed: number, secondsAway: number) => {
      const sim = new Simulation(seed);
      const lvl = sim.loadLevel(1);

      sim.gates.setGates([
        createGate(1, 'add', 5, -1.0, 2.0, 18.0), // Centre Left (+5)
        createGate(2, 'mul', 2, 1.0, 2.0, 18.0),  // Centre Right (x2)
        createGate(3, 'add', 1, 4.0, 3.6, 10.0),  // Screen Left Lane (+1)
        createGate(4, 'add', 1, 4.0, 3.6, 13.0),  // Screen Left Lane (+1)
        createGate(5, 'add', 1, 4.0, 3.6, 16.0),  // Screen Left Lane (+1)
      ]);

      const waves = lvl.waves.map((w) => ({
        ...w,
        minX: -1.75,
        maxX: 1.75
      }));
      sim.waves.setWaves(waves);

      sim.cannon.x = 0;
      sim.cannon.setTargetX(0);

      const departureStartSec = 2.0;
      const departureEndSec = departureStartSec + secondsAway;
      const totalSimulationSec = 45.0;
      const totalTicks = Math.round(totalSimulationSec * 60);

      let peakUnits = 0;
      let clearTime = -1;

      for (let tick = 0; tick < totalTicks; tick++) {
        const timeSec = tick * CONFIG.FIXED_DELTA_TIME;

        if (timeSec >= departureStartSec && timeSec < departureEndSec) {
          sim.cannon.setTargetX(4.0); // Farming Left Lane
        } else {
          sim.cannon.setTargetX(0.0); // Defending Centre Lane
        }

        sim.step(CONFIG.FIXED_DELTA_TIME);

        if (sim.pool.count > peakUnits) {
          peakUnits = sim.pool.count;
        }

        if (sim.isGameWon && clearTime === -1) {
          clearTime = tick / 60;
        }
      }

      const hpLost = CONFIG.BASE_MAX_HP - sim.base.hp;
      return {
        hpLost: Math.round(hpLost),
        clearTime: clearTime > 0 ? clearTime : 45.0,
        peakUnits
      };
    };

    console.log('\n=== 30-SEED AGGREGATED DEPARTURE CURVE: SECONDS AWAY VS BASE HP LOST ===');
    const departureTable = durations.map((sec) => {
      const results = seeds.map((s) => measureDepartureForSeed(s, sec));
      const hpLosts = results.map((r) => r.hpLost);
      const clears = results.map((r) => r.clearTime);
      const peaks = results.map((r) => r.peakUnits);

      const minHp = Math.min(...hpLosts);
      const maxHp = Math.max(...hpLosts);
      const meanHp = (hpLosts.reduce((a, b) => a + b, 0) / numSeeds).toFixed(1);

      const minClear = Math.min(...clears).toFixed(1);
      const maxClear = Math.max(...clears).toFixed(1);
      const meanClear = (clears.reduce((a, b) => a + b, 0) / numSeeds).toFixed(1);

      const meanPeak = Math.round(peaks.reduce((a, b) => a + b, 0) / numSeeds);

      return {
        'Seconds Away': `${sec}s`,
        'Base HP Lost (Mean)': meanHp,
        'Base HP Lost (Min–Max)': `${minHp}–${maxHp}`,
        'Base HP Remaining (Mean)': (100 - parseFloat(meanHp)).toFixed(1),
        'Clear Time (Mean [Min–Max])': `${meanClear}s (${minClear}–${maxClear}s)`,
        'Swarm Peak Units (Mean)': meanPeak
      };
    });

    console.table(departureTable);
  });
});