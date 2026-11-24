import { Simulation } from '../src/sim/loop';
import { CONFIG } from '../src/config/constants';

function runStage3Departure(
  seed: number,
  departureMinute: number,
  durationSec: number = 5
) {
  const endSec = departureMinute * 60 + 20;

  // 1. Baseline: Centre defend without departure
  const simBase = new Simulation(seed);
  simBase.startEndless(0);

  for (let tick = 0; tick < endSec * 60; tick++) {
    if (simBase.base.isGameOver) break;
    let redSumX = 0, redCount = 0;
    for (let i = 0; i < simBase.pool.count; i++) {
      const slot = simBase.pool.activeIndices[i];
      if (simBase.pool.team[slot] === 1 && simBase.pool.z[slot] < 35) {
        redSumX += simBase.pool.x[slot];
        redCount++;
      }
    }
    simBase.cannon.setTargetX(redCount > 0 ? Math.max(-1.75, Math.min(1.75, redSumX / redCount)) : 0);
    simBase.step(CONFIG.FIXED_DELTA_TIME);
  }

  // 2. With 5s departure to farm left lane at departureMinute
  const simDep = new Simulation(seed);
  simDep.startEndless(0);

  const depStart = departureMinute * 60;
  const depEnd = depStart + durationSec;

  for (let tick = 0; tick < endSec * 60; tick++) {
    if (simDep.base.isGameOver) break;
    const sec = tick / 60;
    if (sec >= depStart && sec < depEnd) {
      simDep.cannon.setTargetX(4.0); // Side lane (Left Lane on screen)
    } else {
      let redSumX = 0, redCount = 0;
      for (let i = 0; i < simDep.pool.count; i++) {
        const slot = simDep.pool.activeIndices[i];
        if (simDep.pool.team[slot] === 1 && simDep.pool.z[slot] < 35) {
          redSumX += simDep.pool.x[slot];
          redCount++;
        }
      }
      simDep.cannon.setTargetX(redCount > 0 ? Math.max(-1.75, Math.min(1.75, redSumX / redCount)) : 0);
    }
    simDep.step(CONFIG.FIXED_DELTA_TIME);
  }

  const baselineHpLost = CONFIG.BASE_MAX_HP - simBase.base.hp;
  const departureHpLost = CONFIG.BASE_MAX_HP - simDep.base.hp;
  const incrementalHpLost = Math.max(0, departureHpLost - baselineHpLost);

  return {
    baselineHpLost,
    departureHpLost,
    incrementalHpLost,
    cannonCountAfter: simDep.cannon.cannonCount
  };
}

const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

console.log('=== STAGE 3: DEPARTURE TEST (5s AWAY AT MIN 2, 4, 6) ===');
for (const minute of [2, 4, 6]) {
  const results = seeds.map(s => runStage3Departure(s, minute, 5));
  const baseLosses = results.map(r => r.baselineHpLost);
  const depLosses = results.map(r => r.departureHpLost);
  const incLosses = results.map(r => r.incrementalHpLost);

  const meanBase = (baseLosses.reduce((a, b) => a + b, 0) / 30).toFixed(1);
  const meanDep = (depLosses.reduce((a, b) => a + b, 0) / 30).toFixed(1);
  const meanInc = (incLosses.reduce((a, b) => a + b, 0) / 30).toFixed(1);
  const minInc = Math.min(...incLosses);
  const maxInc = Math.max(...incLosses);

  console.log(`Minute ${minute} (5s departure at t=${minute * 60}s):`);
  console.log(`  Baseline Base HP Lost: ${meanBase} HP`);
  console.log(`  With 5s Departure Base HP Lost: ${meanDep} HP`);
  console.log(`  Net Extra Base HP Cost: +${meanInc} HP (range: ${minInc}–${maxInc} HP)`);
}
