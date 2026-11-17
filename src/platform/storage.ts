import { Preferences } from '@capacitor/preferences';

export interface SaveData {
  highestUnlockedLevel: number; // 1 to 5
  currentLevel: number;
  levelStars: Record<number, number>; // levelId -> stars (1-3)
  soundMuted: boolean;
}

const STORAGE_KEY = 'swarm_gate_save_v1';

export const DEFAULT_SAVE_DATA: SaveData = {
  highestUnlockedLevel: 1,
  currentLevel: 1,
  levelStars: {},
  soundMuted: false
};

/**
 * Durable Save Manager.
 * Uses @capacitor/preferences to store progression and settings natively on Android,
 * with seamless web and headless fallback for node/vitest tests.
 */
export class SaveManager {
  private static cachedData: SaveData = { ...DEFAULT_SAVE_DATA };
  private static memoryStore: Record<string, string> = {};

  /**
   * Loads save data from durable preferences storage.
   */
  public static async load(): Promise<SaveData> {
    if (typeof window === 'undefined') {
      const raw = this.memoryStore[STORAGE_KEY];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          this.cachedData = this.sanitize(parsed);
        } catch {
          this.cachedData = { ...DEFAULT_SAVE_DATA };
        }
      } else {
        this.cachedData = { ...DEFAULT_SAVE_DATA };
      }
      return { ...this.cachedData };
    }

    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        this.cachedData = this.sanitize(parsed);
      } else {
        this.cachedData = { ...DEFAULT_SAVE_DATA };
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to load preferences, using defaults:', e);
      this.cachedData = { ...DEFAULT_SAVE_DATA };
    }

    return { ...this.cachedData };
  }

  private static sanitize(parsed: Record<string, unknown>): SaveData {
    return {
      highestUnlockedLevel: Math.max(1, Math.min(5, Number(parsed.highestUnlockedLevel) || 1)),
      currentLevel: Math.max(1, Math.min(5, Number(parsed.currentLevel) || 1)),
      levelStars: typeof parsed.levelStars === 'object' && parsed.levelStars !== null
        ? (parsed.levelStars as Record<number, number>)
        : {},
      soundMuted: Boolean(parsed.soundMuted)
    };
  }

  /**
   * Returns current synchronous cached save data.
   */
  public static get(): SaveData {
    return { ...this.cachedData };
  }

  /**
   * Persists save data updates into durable preferences storage.
   */
  public static async save(updates: Partial<SaveData>): Promise<SaveData> {
    this.cachedData = {
      ...this.cachedData,
      ...updates
    };

    const serialized = JSON.stringify(this.cachedData);

    if (typeof window === 'undefined') {
      this.memoryStore[STORAGE_KEY] = serialized;
      return { ...this.cachedData };
    }

    try {
      await Preferences.set({
        key: STORAGE_KEY,
        value: serialized
      });
    } catch (e) {
      console.warn('[SaveManager] Failed to persist preferences:', e);
    }

    return { ...this.cachedData };
  }

  /**
   * Marks a level as completed, awarding stars and unlocking the next level.
   */
  public static async completeLevel(
    levelId: number,
    baseHpPercent: number
  ): Promise<{ unlockedNewLevel: boolean; stars: number; highest: number }> {
    const stars = baseHpPercent >= 80 ? 3 : baseHpPercent >= 40 ? 2 : 1;
    const currentStars = this.cachedData.levelStars[levelId] || 0;
    const newStars = Math.max(currentStars, stars);

    const levelStars = {
      ...this.cachedData.levelStars,
      [levelId]: newStars
    };

    let highest = this.cachedData.highestUnlockedLevel;
    let unlockedNewLevel = false;

    if (levelId < 5 && levelId >= highest) {
      highest = levelId + 1;
      unlockedNewLevel = true;
    }

    await this.save({
      highestUnlockedLevel: highest,
      levelStars
    });

    return { unlockedNewLevel, stars: newStars, highest };
  }

  /**
   * Resets save data back to pristine state.
   */
  public static async reset(): Promise<void> {
    this.cachedData = { ...DEFAULT_SAVE_DATA };
    this.memoryStore = {};
    if (typeof window !== 'undefined') {
      try {
        await Preferences.remove({ key: STORAGE_KEY });
      } catch {
        // safe fallback
      }
    }
  }
}
