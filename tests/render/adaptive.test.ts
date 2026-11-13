import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveQualityManager, DprController } from '../../src/render/adaptive';

describe('Adaptive Quality Manager', () => {
  let mockController: DprController & { dpr: number; manualOverride: boolean };

  beforeEach(() => {
    mockController = {
      dpr: 1.0,
      manualOverride: false,
      hasManualDprOverride() {
        return this.manualOverride;
      },
      setDynamicDpr(val: number) {
        this.dpr = val;
      }
    };
  });

  it('lowers pixel ratio first when average frame time exceeds budget', () => {
    const adaptive = new AdaptiveQualityManager(mockController);
    expect(adaptive.getSettings().dpr).toBe(1.0);

    // Simulate 2.5 seconds of heavy frame time (25ms = 40 fps)
    for (let i = 0; i < 100; i++) {
      adaptive.update(25);
    }

    const settings = adaptive.getSettings();
    // DPR lowered first
    expect(settings.dpr).toBeLessThan(1.0);
    expect(mockController.dpr).toBeLessThan(1.0);
    // Unit cap and particles should not have degraded yet
    expect(settings.unitCapMultiplier).toBe(1.0);
    expect(settings.particleMultiplier).toBe(1.0);
  });

  it('degrades unit cap second after DPR has been lowered', () => {
    const adaptive = new AdaptiveQualityManager(mockController);

    // Lower DPR step by step
    for (let step = 0; step < 3; step++) {
      for (let i = 0; i < 100; i++) {
        adaptive.update(25);
      }
    }

    const settings = adaptive.getSettings();
    expect(settings.dpr).toBeLessThanOrEqual(0.8);
    // Unit cap is now throttled
    expect(settings.unitCapMultiplier).toBeLessThan(1.0);
  });

  it('only raises quality when sustained headroom is observed', () => {
    const adaptive = new AdaptiveQualityManager(mockController);

    // Initial downgrade
    for (let i = 0; i < 100; i++) {
      adaptive.update(25);
    }
    const degradedDpr = adaptive.getSettings().dpr;
    expect(degradedDpr).toBeLessThan(1.0);

    // Short headroom (< 5.0s) should NOT immediately bump quality
    for (let i = 0; i < 50; i++) {
      adaptive.update(12); // fast 12ms frame time
    }
    expect(adaptive.getSettings().dpr).toBe(degradedDpr);

    // Sustained headroom (> 5.0s: needs at least 3 x 2.0s windows = 6.0s = 500 x 12ms calls)
    for (let i = 0; i < 550; i++) {
      adaptive.update(12);
    }
    expect(adaptive.getSettings().dpr).toBeGreaterThan(degradedDpr);
  });
});
