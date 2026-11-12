import { describe, it, expect, vi } from 'vitest';
import { Simulation } from '../../src/sim/loop';

describe('Zero Allocations in Simulation Loop', () => {
  it('does not invoke any Array allocation methods during sim steps', () => {
    const sim = new Simulation(42, 1000);
    sim.setStressMode(500);

    // Warm up the simulation so 500 units are active in the pool
    for (let i = 0; i < 200; i++) {
      sim.step(1 / 60);
    }
    expect(sim.pool.count).toBe(500);

    // Spy on dynamic array methods to guarantee zero array allocations
    const pushSpy = vi.spyOn(Array.prototype, 'push');
    const sliceSpy = vi.spyOn(Array.prototype, 'slice');
    const spliceSpy = vi.spyOn(Array.prototype, 'splice');
    const concatSpy = vi.spyOn(Array.prototype, 'concat');

    // Run 120 steps (2 seconds of 60 Hz simulation with 500 active mobs)
    for (let i = 0; i < 120; i++) {
      sim.step(1 / 60);
    }

    expect(pushSpy).not.toHaveBeenCalled();
    expect(sliceSpy).not.toHaveBeenCalled();
    expect(spliceSpy).not.toHaveBeenCalled();
    expect(concatSpy).not.toHaveBeenCalled();

    pushSpy.mockRestore();
    sliceSpy.mockRestore();
    spliceSpy.mockRestore();
    concatSpy.mockRestore();
  });

  it('runs 1,000 steps with 500 active units without leaking memory', () => {
    const sim = new Simulation(99, 1000);
    sim.setStressMode(500);

    // Warm up JIT and fill pool
    for (let i = 0; i < 200; i++) {
      sim.step(1 / 60);
    }
    expect(sim.pool.count).toBe(500);

    // Run 1,000 simulation steps
    for (let i = 0; i < 1000; i++) {
      sim.step(1 / 60);
    }

    // Still exactly 500 active units and pool integrity preserved
    expect(sim.pool.count).toBe(500);
    expect(sim.pool.freeCount).toBe(500);
  });
});
