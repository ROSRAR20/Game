import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Mobile Haptics Manager.
 * Wraps @capacitor/haptics with native mobile tactile feedback and safe browser fallback.
 */
export class HapticsManager {
  private static lastImpactTime = 0;
  private static userInteracted = false;

  static {
    if (typeof window !== 'undefined') {
      const mark = () => {
        HapticsManager.userInteracted = true;
        window.removeEventListener('pointerdown', mark, true);
        window.removeEventListener('touchstart', mark, true);
      };
      window.addEventListener('pointerdown', mark, true);
      window.addEventListener('touchstart', mark, true);
    }
  }

  /**
   * Light tactile tap (e.g. cannon fire).
   * Throttled to prevent motor fatigue/buzzing.
   */
  public static async light(): Promise<void> {
    const now = performance.now();
    if (now - this.lastImpactTime < 180) {
      return;
    }
    this.lastImpactTime = now;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Browser fallback (only when user has interacted with the page)
      if (this.userInteracted && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(10); } catch { /* noop */ }
      }
    }
  }

  /**
   * Medium tactile click (e.g. gate pass, "LV+1" pickup collection).
   */
  public static async medium(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      if (this.userInteracted && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch { /* noop */ }
      }
    }
  }

  /**
   * Heavy tactile thump (e.g. tower destroyed, base taking breach damage).
   */
  public static async heavy(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      if (this.userInteracted && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(50); } catch { /* noop */ }
      }
    }
  }

  /**
   * Victory / Success pattern (e.g. level completion).
   */
  public static async success(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if (this.userInteracted && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([30, 60, 40]); } catch { /* noop */ }
      }
    }
  }
}
