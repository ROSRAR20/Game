import { describe, it } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';
import { createGate } from '../../src/sim/gates';

describe('Headless Balance & Lane Departure Curve', () => {
  it('measures Base HP lost under Option A 3-lane layout as a function of seconds away from Centre lane', () => {
    const seed = 42;

    const measureOptionADeparture = (secondsAway: number) => {
      const sim = new Simulation(seed);
      const lvl = sim.loadLevel(1);

      // Apply Option A Gate & Wave setup:
      // Centre lane gates at Z = 18 strictly inside X in [-2.0, 2.0]
      sim.gates.setGates([
        createGate(1, 'add', 5, -1.0, 2.0, 18.0), // Centre Left (+5)
        createGate(2, 'mul', 2, 1.0, 2.0, 18.0),  // Centre Right (x2)
        createGate(3, 'add', 1, -4.0, 3.6, 10.0), // Left Lane (+1)
        createGate(4, 'add', 1, -4.0, 3.6, 13.0), // Left Lane (+1)
        createGate(5, 'add', 1, -4.0, 3.6, 16.0), // Left Lane (+1)
      ]);

      // Restrict waves strictly to Centre lane: minX = -1.75, maxX = 1.75
      const waves = lvl.waves.map((w) => ({
        ...w,
        minX: -1.75,
        maxX: 1.75
      }));
      sim.waves.setWaves(waves);

      sim.cannon.x = 0;
      sim.cannon.setTargetX(0);

      const departureStartSec = 2.0; // steers away at t = 2.0s when Wave 1 triggers
      const departureEndSec = departureStartSec + secondsAway;
      const totalSimulationSec = 45.0;
      const totalTicks = Math.round(totalSimulationSec * 60);

      let peakUnits = 0;
      let clearTime = -1;

      for (let tick = 0; tick < totalTicks; tick++) {
        const timeSec = tick * CONFIG.FIXED_DELTA_TIME;

        if (timeSec >= departureStartSec && timeSec < departureEndSec) {
          sim.cannon.setTargetX(-4.0); // Farming Left Lane
        } else {
          sim.cannon.setTargetX(0.0);  // Defending Centre Lane
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
        secondsAway,
        baseHpRemaining: Math.round(sim.base.hp),
        baseHpLost: Math.round(hpLost),
        isGameOver: sim.base.isGameOver,
        isWon: sim.isGameWon,
        clearTimeSec: clearTime > 0 ? clearTime.toFixed(1) : 'DNF',
        peakUnits
      };
    };

    console.log('\n=== REAL OPTION A (3-LANE LAYOUT): SECONDS AWAY VS BASE HP LOST (Seed: 42) ===');
    const durations = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30];
    const results = durations.map((d) => measureOptionADeparture(d));
    console.table(results);
  });
});
