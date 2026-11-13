import { CONFIG } from '../config/constants';

export interface DprController {
  hasManualDprOverride(): boolean;
  setDynamicDpr(dpr: number): void;
}

export interface AdaptiveSettings {
  dpr: number;
  unitCapMultiplier: number;
  particleMultiplier: number;
}

/**
 * Adaptive Quality Controller
 * Adjusts visual quality dynamically to prevent frame-rate drops when the phone heats up:
 *  1. Lowers pixel ratio first (fill rate bottleneck on mid-tier GPUs)
 *  2. Lowers unit cap second (CPU / vertex bottleneck)
 *  3. Lowers particle count third (fill rate / blend overhead)
 * Only raises DPR when frame time has sustained, clear headroom.
 */
export class AdaptiveQualityManager {
  private dprController: DprController;

  // Frame timing accumulators
  private frameTimeSum: number = 0;
  private frameCount: number = 0;
  private sampleTimer: number = 0;

  // Headroom stability tracking
  private headroomDuration: number = 0;

  // Quality state
  private currentDpr: number = CONFIG.DEFAULT_DPR;
  private unitCapMultiplier: number = 1.0;
  private particleMultiplier: number = 1.0;

  constructor(dprController: DprController) {
    this.dprController = dprController;
    this.currentDpr = CONFIG.DEFAULT_DPR;
  }

  public update(frameDeltaMs: number): void {
    this.frameTimeSum += frameDeltaMs;
    this.frameCount++;
    this.sampleTimer += frameDeltaMs / 1000;

    // Evaluate over the evaluation window (e.g. 2.0s)
    if (this.sampleTimer >= CONFIG.ADAPTIVE_QUALITY.WINDOW_DURATION_SEC) {
      const avgFrameTimeMs = this.frameTimeSum / Math.max(1, this.frameCount);

      this.evaluateQuality(avgFrameTimeMs);

      // Reset window accumulators
      this.frameTimeSum = 0;
      this.frameCount = 0;
      this.sampleTimer = 0;
    }
  }

  private evaluateQuality(avgFrameTimeMs: number): void {
    // 1. Throttle / Downgrade condition (struggling device or thermal throttling)
    if (avgFrameTimeMs > CONFIG.ADAPTIVE_QUALITY.DOWNGRADE_THRESHOLD_MS) {
      this.headroomDuration = 0; // Reset headroom counter

      if (!this.dprController.hasManualDprOverride() && this.currentDpr > 0.8) {
        // Step 1: Lower pixel ratio first
        this.currentDpr = Math.max(0.75, this.currentDpr - 0.15);
        this.dprController.setDynamicDpr(this.currentDpr);
        console.warn(`[AdaptiveQuality] Frame time ${avgFrameTimeMs.toFixed(1)}ms > budget. Lowering DPR to ${this.currentDpr.toFixed(2)}`);
      } else if (this.unitCapMultiplier > 0.6) {
        // Step 2: Lower unit cap
        this.unitCapMultiplier = Math.max(0.5, this.unitCapMultiplier - 0.2);
        console.warn(`[AdaptiveQuality] Frame time ${avgFrameTimeMs.toFixed(1)}ms. Lowering unit cap multiplier to ${this.unitCapMultiplier.toFixed(2)}`);
      } else if (this.particleMultiplier > 0.2) {
        // Step 3: Lower particle count
        this.particleMultiplier = Math.max(0.0, this.particleMultiplier - 0.4);
        console.warn(`[AdaptiveQuality] Lowering particle multiplier to ${this.particleMultiplier.toFixed(2)}`);
      }
      return;
    }

    // 2. Headroom / Upgrade condition
    if (avgFrameTimeMs < CONFIG.ADAPTIVE_QUALITY.UPGRADE_THRESHOLD_MS) {
      this.headroomDuration += CONFIG.ADAPTIVE_QUALITY.WINDOW_DURATION_SEC;

      // Require sustained headroom before cautiously increasing quality
      if (this.headroomDuration >= CONFIG.ADAPTIVE_QUALITY.UPGRADE_STABLE_SEC) {
        this.headroomDuration = 0;

        if (this.particleMultiplier < 1.0) {
          // Restore particles first
          this.particleMultiplier = Math.min(1.0, this.particleMultiplier + 0.3);
        } else if (this.unitCapMultiplier < 1.0) {
          // Restore unit cap second
          this.unitCapMultiplier = Math.min(1.0, this.unitCapMultiplier + 0.2);
        } else if (!this.dprController.hasManualDprOverride() && this.currentDpr < CONFIG.MAX_DPR) {
          // Raise DPR only when CPU and vertex budgets are already maxed and headroom is sustained
          this.currentDpr = Math.min(CONFIG.MAX_DPR, this.currentDpr + 0.1);
          this.dprController.setDynamicDpr(this.currentDpr);
        }
      }
    } else {
      this.headroomDuration = 0;
    }
  }

  public getSettings(): AdaptiveSettings {
    return {
      dpr: this.currentDpr,
      unitCapMultiplier: this.unitCapMultiplier,
      particleMultiplier: this.particleMultiplier
    };
  }
}
