import { describe, it } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';

interface BotRunResult {
  survivalTimeSec: number;
  score: number;
  peakUnits: number;
  capHits: number;
  kills: number;
}

function runBotSimulation(
  seed: number,
  botType: 'idle' | 'centre_defend' | 'sweeper',
  cannonCount: number = 1,
  startAtSec: number = 0,
  maxDurationSec: number = 300
): BotRunResult {
  const sim = new Simulation(seed);
  sim.startEndless(startAtSec);
  sim.cannon.setCannonCount(cannonCount);

  let peakUnits = 0;
  let capHits = 0;
  const maxTicks = maxDurationSec * 60;

  for (let tick = 0; tick < maxTicks; tick++) {
    if (sim.base.isGameOver) {
      break;
    }

    // Bot Steering Logic
    if (botType === 'idle') {
      sim.cannon.setTargetX(0.0);
    } else if (botType === 'centre_defend') {
      // Track average X of active red units in near half
      let redSumX = 0;
      let redCountNear = 0;
      for (let i = 0; i < sim.pool.count; i++) {
        const slot = sim.pool.activeIndices[i];
        if (sim.pool.team[slot] === 1 && sim.pool.z[slot] < 35.0) {
          redSumX += sim.pool.x[slot];
          redCountNear++;
        }
      }
      if (redCountNear > 0) {
        const targetX = redSumX / redCountNear;
        sim.cannon.setTargetX(Math.max(-1.75, Math.min(1.75, targetX)));
      } else {
        sim.cannon.setTargetX(0.0);
      }
    } else if (botType === 'sweeper') {
      // Sweeper alternates smoothly between left gate (+5 at X=-1) and right gate (x2 at X=1)
      const sweepCycle = (tick % 180) / 180; // 3-second cycle
      const targetX = Math.sin(sweepCycle * Math.PI * 2) * 1.5;
      sim.cannon.setTargetX(targetX);
    }

    sim.step(CONFIG.FIXED_DELTA_TIME);

    if (sim.pool.count > peakUnits) {
      peakUnits = sim.pool.count;
    }
    if (sim.pool.count >= CONFIG.MAX_UNITS - 50) {
      capHits++;
    }
  }

  const survivalTimeSec = Number((sim.ticks / 60 - startAtSec).toFixed(1));
  const score = sim.endless.getScore(sim.ticks);

  return {
    survivalTimeSec,
    score,
    peakUnits,
    capHits,
    kills: sim.endless.kills
  };
}

describe('30-Seed Bot Simulations & Unit Load Suite (Amendment 4 & 5)', () => {
  it('runs 30-seed simulation across 3 automated bots and measures real survival', () => {
    const numSeeds = 30;
    const seeds = Array.from({ length: numSeeds }, (_, i) => i + 1);

    const botTypes: Array<'idle' | 'centre_defend' | 'sweeper'> = ['idle', 'centre_defend', 'sweeper'];

    const summaryTable = botTypes.map((botType) => {
      const results = seeds.map((s) => runBotSimulation(s, botType, 1, 0, 300));
      const times = results.map((r) => r.survivalTimeSec);
      const peaks = results.map((r) => r.peakUnits);
      const scores = results.map((r) => r.score);
      const kills = results.map((r) => r.kills);

      const minTime = Math.min(...times).toFixed(1);
      const maxTime = Math.max(...times).toFixed(1);
      const meanTime = (times.reduce((a, b) => a + b, 0) / numSeeds).toFixed(1);

      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const meanScore = Math.round(scores.reduce((a, b) => a + b, 0) / numSeeds);

      const meanPeak = Math.round(peaks.reduce((a, b) => a + b, 0) / numSeeds);
      const meanKills = Math.round(kills.reduce((a, b) => a + b, 0) / numSeeds);

      return {
        'Bot Type': botType,
        'Survival Time (Mean [Min–Max])': `${meanTime}s (${minTime}–${maxTime}s)`,
        'Score (Mean [Min–Max])': `${meanScore} (${minScore}–${maxScore})`,
        'Mean Kills': meanKills,
        'Mean Peak Units': meanPeak
      };
    });

    console.log('\n=== REAL 30-SEED BOT PERFORMANCE TABLE ===');
    console.table(summaryTable);
  });

  it('measures unit load for a count-6 bot at minute 10 (?startAt=600&count=6) (Amendment 4)', () => {
    // 6 shooters, difficulty clock at 600s (10 min), runs for 60s of extreme horde combat
    const result = runBotSimulation(42, 'sweeper', 6, 600, 60);

    console.log('\n=== MINUTE 10 (COUNT-6) UNIT LOAD STRESS METRICS ===', {
      startAt: '600s (Minute 10)',
      cannonCount: 6,
      testedDuration: '60s',
      peakUnits: result.peakUnits,
      capHits: result.capHits,
      maxUnitLimit: CONFIG.MAX_UNITS,
      killsIn60s: result.kills,
      unitHeadroom: CONFIG.MAX_UNITS - result.peakUnits
    });
  });
});
