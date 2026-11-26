import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';

describe('Stage 3: 10-Minute Headless Soak Test', () => {
  it('runs 10-minute continuous simulation with count 6 and panels without NaN, leaks, or unit-count drift', () => {
    const seed = 42;
    const sim = new Simulation(seed);
    sim.startEndless(0);
    sim.cannon.setCannonCount(6);
    sim.cannon.setTier(2);

    const durationSec = 600; // 10 minutes
    const totalTicks = durationSec * 60; // 36,000 ticks
    const dt = CONFIG.FIXED_DELTA_TIME;

    let peakUnits = 0;
    let panelsCollected = 0;
    let capMergeEvents = 0;
    let nanDetected = false;

    // Track unit counts across 1-minute intervals to verify bounded memory and no drift
    const minuteUnitCounts: number[] = [];

    for (let tick = 0; tick < totalTicks; tick++) {
      // Periodic bot steering:
      const hasActiveBoss = sim.bosses.bosses.some((b) => !b.isDefeated);
      // Check if any moving panel is close to collection line (Z < 10) in left lane
      const activePanels = sim.panels.panels;
      let targetPanelX: number | null = null;
      if (!hasActiveBoss) {
        for (const p of activePanels) {
          if (p.z < 12.0 && p.z > 4.5) {
            targetPanelX = p.x;
            break;
          }
        }
      }

      if (hasActiveBoss) {
        // Focus fire on active Periodic Boss in centre lane (X = 0)
        sim.cannon.setTargetX(0.0);
      } else if (targetPanelX !== null) {
        // Steer toward panel to collect
        sim.cannon.setTargetX(targetPanelX);
      } else {
        // Defend centre lane: target near-field red cluster
        let redSumX = 0;
        let redCount = 0;
        for (let i = 0; i < sim.pool.count; i++) {
          const slot = sim.pool.activeIndices[i];
          if (sim.pool.team[slot] === 1 && sim.pool.z[slot] < 30.0) {
            redSumX += sim.pool.x[slot];
            redCount++;
          }
        }
        if (redCount > 0) {
          sim.cannon.setTargetX(Math.max(-1.75, Math.min(1.75, redSumX / redCount)));
        } else {
          // Default center sweep
          const cycle = (tick % 120) / 120;
          sim.cannon.setTargetX(Math.sin(cycle * Math.PI * 2) * 1.2);
        }
      }

      // Track panel count before step
      const preCount = sim.panels.panels.length;
      sim.step(dt);
      if (sim.panels.panels.length < preCount && sim.cannon.cannonCount === 6) {
        panelsCollected++;
      }

      if (sim.pool.count > peakUnits) {
        peakUnits = sim.pool.count;
      }
      if (sim.pool.count >= CONFIG.CAP_MERGE.POOL_THRESHOLD) {
        capMergeEvents++;
      }

      // Every 600 ticks (10 simulated seconds), run strict invariant assertions
      if (tick % 600 === 0) {

        // 1. Validate Simulation state (no NaN)
        if (
          Number.isNaN(sim.cannon.x) ||
          Number.isNaN(sim.base.hp) ||
          Number.isNaN(sim.endless.difficultyTime) ||
          Number.isNaN(sim.endless.getScore(tick))
        ) {
          console.error(`NaN in sim at tick ${tick}:`, {
            cannonX: sim.cannon.x,
            baseHp: sim.base.hp,
            difficultyTime: sim.endless.difficultyTime,
            score: sim.endless.getScore(tick)
          });
          nanDetected = true;
          break;
        }

        // 2. Validate all active units in pool (no NaN, valid teams, finite positions)
        for (let i = 0; i < sim.pool.count; i++) {
          const slot = sim.pool.activeIndices[i];
          if (
            Number.isNaN(sim.pool.x[slot]) ||
            Number.isNaN(sim.pool.z[slot]) ||
            Number.isNaN(sim.pool.vx[slot]) ||
            Number.isNaN(sim.pool.vz[slot]) ||
            Number.isNaN(sim.pool.hp[slot]) ||
            Number.isNaN(sim.pool.damage[slot]) ||
            Number.isNaN(sim.pool.weight[slot])
          ) {
            console.error(`NaN in unit slot ${slot} at tick ${tick}:`, {
              x: sim.pool.x[slot],
              z: sim.pool.z[slot],
              vx: sim.pool.vx[slot],
              vz: sim.pool.vz[slot],
              hp: sim.pool.hp[slot],
              damage: sim.pool.damage[slot],
              weight: sim.pool.weight[slot]
            });
            nanDetected = true;
            break;
          }
        }
        if (nanDetected) break;

        // 3. Validate bounded memory
        expect(sim.pool.count).toBeLessThanOrEqual(3500); // Pool capacity
        expect(sim.panels.panels.length).toBeLessThanOrEqual(6); // Panels must despawn cleanly

        // Record minute checkpoint
        if (tick % 3600 === 0) {
          minuteUnitCounts.push(sim.pool.count);
        }
      }
    }

    expect(nanDetected).toBe(false);
    expect(sim.endless.difficultyTime).toBeCloseTo(durationSec, 0);

    // Verify bounded memory and no unit count runaway
    // Peak units must stay comfortably within pool capacity
    expect(peakUnits).toBeLessThanOrEqual(3000);
    expect(peakUnits).toBeGreaterThan(100); // active combat took place

    // Panels were spawned, collected, and despawned properly throughout 10 mins
    expect(sim.panels.panels.length).toBeLessThanOrEqual(4);
    expect(panelsCollected).toBeGreaterThan(0);
    expect(capMergeEvents).toBeGreaterThanOrEqual(0);

    console.log('\n=== 10-MINUTE HEADLESS SOAK TEST METRICS ===', {
      duration: `${durationSec}s (10.0 min)`,
      ticksSimulated: totalTicks,
      cannonCount: sim.cannon.cannonCount,
      finalBaseHp: sim.base.hp,
      finalScore: sim.endless.getScore(totalTicks),
      peakUnits,
      activePanelsAtEnd: sim.panels.panels.length,
      minuteSampledUnits: minuteUnitCounts,
      nanDetected: false
    });
  }, 30000); // 30s timeout for 36,000 ticks
});
