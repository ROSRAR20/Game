import { Simulation } from '../src/sim/loop';
import { CONFIG } from '../src/config/constants';
import { EndlessConfig, DEFAULT_ENDLESS_CONFIG } from '../src/sim/endless';

interface BotRunResult {
  survivalTimeSec: number;
  score: number;
  peakUnits: number;
  capHits: number;
  kills: number;
  baseHpRemaining: number;
}

function runBot(
  seed: number,
  botType: 'idle' | 'centre_defend' | 'sweeper' | 'departure',
  config: EndlessConfig,
  cannonCount: number = 1,
  startAtSec: number = 0,
  maxDurationSec: number = 1200,
  departureTimeSec?: number,
  departureDurationSec?: number
): BotRunResult {
  const sim = new Simulation(seed);
  sim.endless.config = { ...config };
  sim.startEndless(startAtSec);
  sim.cannon.setCannonCount(cannonCount);

  let peakUnits = 0;
  let capHits = 0;
  const maxTicks = maxDurationSec * 60;

  for (let tick = 0; tick < maxTicks; tick++) {
    if (sim.base.isGameOver) {
      break;
    }
    const currentSec = tick / 60;

    // Bot Steering Logic
    if (botType === 'idle') {
      sim.cannon.setTargetX(0.0);
    } else if (botType === 'centre_defend') {
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
      const sweepCycle = (tick % 180) / 180;
      const targetX = Math.sin(sweepCycle * Math.PI * 2) * 1.5;
      sim.cannon.setTargetX(targetX);
    } else if (botType === 'departure') {
      // Normally centre defend, but departs to X=4 (Right lane) during [departureTime, departureTime + departureDuration]
      const depStart = departureTimeSec || 120;
      const depEnd = depStart + (departureDurationSec || 5);
      if (currentSec >= depStart && currentSec < depEnd) {
        sim.cannon.setTargetX(4.0); // Side lane
      } else {
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
      }
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
    kills: sim.endless.kills,
    baseHpRemaining: sim.base.hp
  };
}

async function main() {
  console.log('--- 1. Testing Default Config with 20-min limit ---');
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  for (const bot of ['idle', 'centre_defend', 'sweeper'] as const) {
    const res = seeds.map(s => runBot(s, bot, DEFAULT_ENDLESS_CONFIG, 1, 0, 1200));
    const times = res.map(r => r.survivalTimeSec);
    const minT = Math.min(...times).toFixed(1);
    const maxT = Math.max(...times).toFixed(1);
    const meanT = (times.reduce((a, b) => a + b, 0) / 30).toFixed(1);
    console.log(`Default ${bot}: mean=${meanT}s (min=${minT}s, max=${maxT}s)`);
  }

  console.log('\n--- 2. Testing Candidate Tuned Configs ---');
  // Target:
  // - idle dies in ~60-90s
  // - centre-only count-1 bot with no upgrades dies in about 4-6 min (240-360s)
  // Let's test a grid of candidate configs:
  // e.g. baseSpawnRate: 2.0 - 3.0, spawnRateRampPerMin: 2.0 - 3.5, tier progressions
  const candidates: Array<{ name: string; cfg: EndlessConfig }> = [
    {
      name: 'Candidate A: baseSpawn=2.5, ramp=2.5, baseSpeed=2.6, speedRamp=0.08',
      cfg: {
        baseSpawnRate: 2.5,
        spawnRateRampPerMin: 2.5,
        maxSpawnRate: 20.0,
        baseSpeed: 2.6,
        speedRampPerMin: 0.08,
        maxSpeed: 3.5,
        maxRedUnits: 800
      }
    },
    {
      name: 'Candidate B: baseSpawn=2.8, ramp=2.8, baseSpeed=2.6, speedRamp=0.08',
      cfg: {
        baseSpawnRate: 2.8,
        spawnRateRampPerMin: 2.8,
        maxSpawnRate: 20.0,
        baseSpeed: 2.6,
        speedRampPerMin: 0.08,
        maxSpeed: 3.5,
        maxRedUnits: 800
      }
    },
    {
      name: 'Candidate C: baseSpawn=3.0, ramp=3.0, baseSpeed=2.7, speedRamp=0.10',
      cfg: {
        baseSpawnRate: 3.0,
        spawnRateRampPerMin: 3.0,
        maxSpawnRate: 22.0,
        baseSpeed: 2.7,
        speedRampPerMin: 0.10,
        maxSpeed: 3.6,
        maxRedUnits: 900
      }
    }
  ];

  for (const cand of candidates) {
    console.log(`\nEvaluating ${cand.name}:`);
    for (const bot of ['idle', 'centre_defend'] as const) {
      const res = seeds.map(s => runBot(s, bot, cand.cfg, 1, 0, 1200));
      const times = res.map(r => r.survivalTimeSec);
      const minT = Math.min(...times).toFixed(1);
      const maxT = Math.max(...times).toFixed(1);
      const meanT = (times.reduce((a, b) => a + b, 0) / 30).toFixed(1);
      console.log(`  ${bot}: mean=${meanT}s (${minT}–${maxT}s)`);
    }
  }
}

main().catch(console.error);
