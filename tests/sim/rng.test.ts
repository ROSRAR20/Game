import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/sim/rng';

describe('Seeded PRNG (Mulberry32)', () => {
  it('is completely deterministic with the same seed', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    for (let i = 0; i < 50; i++) {
      expect(rng1.nextFloat()).toBe(rng2.nextFloat());
    }
  });

  it('produces different sequences with different seeds', () => {
    const rng1 = new SeededRNG(100);
    const rng2 = new SeededRNG(200);

    let identical = true;
    for (let i = 0; i < 10; i++) {
      if (rng1.nextFloat() !== rng2.nextFloat()) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(false);
  });

  it('generates floats strictly within [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextFloat();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('generates integers within specified [min, max] range', () => {
    const rng = new SeededRNG(99);
    for (let i = 0; i < 200; i++) {
      const val = rng.nextInt(3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});
