import { Simulation } from '../src/sim/loop';
import { CONFIG } from '../src/config/constants';

interface BotRunResult {
  survivalTimeSec: number;
  score: number;
  peakUnits: number;
  capHits: number;
  kills: number;
  maxShooterCount: number;
  panelsCollected: number;
}

function runStage3Bot(
  seed: number,
  botType: 'idle' | 'centre_defend' | 'panel_farmer',
  startAtSec: number = 0,
  maxDurationSec: number = 1200
): BotRunResult {
  const sim = new Simulation(seed);
  sim.startEndless(startAtSec);

  let peakUnits = 0;
  let capHits = 0;
  let maxShooterCount = 1;
  let panelsCollected = 0;
  const maxTicks = maxDurationSec * 60;

  for (let tick = 0; tick < maxTicks; tick++) {
    if (sim.base.isGameOver) {
      break;
    }

    if (sim.cannon.cannonCount > maxShooterCount) {
      maxShooterCount = sim.cannon.cannonCount;
    }

    // Bot Steering Logic
    if (botType === 'idle') {
      sim.cannon.setTargetX(0.0);
    } else if (botType === 'centre_defend') {
      let redSumX = 0, redCount = 0;
      for (let i = 0; i < sim.pool.count; i++) {
        const slot = sim.pool.activeIndices[i];
        if (sim.pool.team[slot] === 1 && sim.pool.z[slot] < 35.0) {
          redSumX += sim.pool.x[slot];
          redCount++;
        }
      }
      sim.cannon.setTargetX(redCount > 0 ? Math.max(-1.75, Math.min(1.75, redSumX / redCount)) : 0.0);
    } else if (botType === 'panel_farmer') {
      // Panel Farmer: if a panel is approaching in left lane (Z < 15) and cannon < 6,
      // temporarily steer to X = 4.0 to collect it; otherwise defend centre lane
      const activePanels = sim.panels.panels;
      const nearPanel = activePanels.find(p => p.z < 16 && p.z > 4);

      if (nearPanel && sim.cannon.cannonCount < 6) {
        sim.cannon.setTargetX(nearPanel.x);
      } else {
        let redSumX = 0, redCount = 0;
        for (let i = 0; i < sim.pool.count; i++) {
          const slot = sim.pool.activeIndices[i];
          if (sim.pool.team[slot] === 1 && sim.pool.z[slot] < 35.0) {
            redSumX += sim.pool.x[slot];
            redCount++;
          }
        }
        sim.cannon.setTargetX(redCount > 0 ? Math.max(-1.75, Math.min(1.75, redSumX / redCount)) : 0.0);
      }
    }

    const prevCount = sim.cannon.cannonCount;
    sim.step(CONFIG.FIXED_DELTA_TIME);
    if (sim.cannon.cannonCount > prevCount) {
      panelsCollected++;
    }

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
    maxShooterCount,
    panelsCollected
  };
}

const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

console.log('=== STAGE 3: 30-SEED BOT PERFORMANCE (PANELS + FORMATION 1-6) ===');
for (const bot of ['idle', 'centre_defend', 'panel_farmer'] as const) {
  const results = seeds.map(s => runStage3Bot(s, bot, 0, 1200));
  const times = results.map(r => r.survivalTimeSec);
  const scores = results.map(r => r.score);
  const kills = results.map(r => r.kills);
  const peaks = results.map(r => r.peakUnits);
  const shooters = results.map(r => r.maxShooterCount);
  const panels = results.map(r => r.panelsCollected);

  const meanT = (times.reduce((a, b) => a + b, 0) / 30).toFixed(1);
  const minT = Math.min(...times).toFixed(1);
  const maxT = Math.max(...times).toFixed(1);

  const meanScore = Math.round(scores.reduce((a, b) => a + b, 0) / 30);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const meanKills = Math.round(kills.reduce((a, b) => a + b, 0) / 30);
  const meanPeak = Math.round(peaks.reduce((a, b) => a + b, 0) / 30);
  const meanShooters = (shooters.reduce((a, b) => a + b, 0) / 30).toFixed(1);
  const meanPanels = (panels.reduce((a, b) => a + b, 0) / 30).toFixed(1);

  console.log(`Bot: ${bot}`);
  console.log(`  Survival Time: ${meanT}s (${minT}–${maxT}s)`);
  console.log(`  Score: ${meanScore} (${minScore}–${maxScore})`);
  console.log(`  Mean Kills: ${meanKills}`);
  console.log(`  Mean Peak Units: ${meanPeak}`);
  console.log(`  Shooters Reached: ${meanShooters} (max: ${Math.max(...shooters)})`);
  console.log(`  Panels Collected: ${meanPanels}`);
}
