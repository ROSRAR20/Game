import { Simulation } from '../src/sim/loop';
import { CONFIG } from '../src/config/constants';

function testLoad(targetUnits: number) {
  const sim = new Simulation(42);
  sim.startEndless(0);
  const halfBlue = Math.floor(targetUnits / 2);
  const halfRed = Math.ceil(targetUnits / 2);
  sim.setCombatStressMode(halfBlue, halfRed);

  let peakUnits = 0;
  let capHits = 0;
  // Step 300 ticks (5 seconds) to allow initial batches to reach target load
  for (let tick = 0; tick < 300; tick++) {
    sim.step(CONFIG.FIXED_DELTA_TIME);
    if (sim.pool.count > peakUnits) {
      peakUnits = sim.pool.count;
    }
    if (sim.pool.count >= CONFIG.MAX_UNITS - 50) {
      capHits++;
    }
  }

  const { blue, red } = sim.getTeamCounts();
  return {
    targetUnits,
    peakUnits,
    currentUnits: sim.pool.count,
    blueUnits: blue,
    redUnits: red,
    capHits,
    freeUnits: sim.pool.freeCount,
    poolCapacity: CONFIG.MAX_UNITS
  };
}

console.log('=== REAL SEEDED LOAD TEST (N = 2000, 2500, 3000) ===');
for (const n of [2000, 2500, 3000]) {
  const res = testLoad(n);
  console.log(`?load=${n}:`, res);
}
