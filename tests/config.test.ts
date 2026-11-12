import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config/constants';

describe('Game Configuration', () => {
  it('defines valid road geometry bounds', () => {
    expect(CONFIG.ROAD_WIDTH).toBeGreaterThan(0);
    expect(CONFIG.ROAD_LENGTH).toBeGreaterThan(0);
    expect(CONFIG.ROAD_X_MIN).toBeLessThan(CONFIG.ROAD_X_MAX);
    expect(CONFIG.ROAD_Z_MIN).toBeLessThan(CONFIG.ROAD_Z_MAX);
  });

  it('keeps cannon movement within road width', () => {
    expect(CONFIG.CANNON_MIN_X).toBeGreaterThanOrEqual(CONFIG.ROAD_X_MIN);
    expect(CONFIG.CANNON_MAX_X).toBeLessThanOrEqual(CONFIG.ROAD_X_MAX);
    expect(CONFIG.CANNON_Z).toBeGreaterThan(CONFIG.ROAD_Z_MIN);
  });

  it('enforces maximum DPR limit for mobile GPU fill-rate protection', () => {
    expect(CONFIG.MAX_DPR).toBeLessThanOrEqual(2.0);
    expect(CONFIG.MAX_DPR).toBeGreaterThan(0.5);
  });

  it('enforces 60 Hz fixed simulation step', () => {
    expect(CONFIG.SIM_HERTZ).toBe(60);
    expect(CONFIG.FIXED_DELTA_TIME).toBeCloseTo(1 / 60, 5);
  });
});
