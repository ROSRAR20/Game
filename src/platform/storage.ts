import { Preferences } from '@capacitor/preferences';

export interface SaveData {
  // Endless Run V2 schema
  bestScore: number;
  bestTimeSec: number;
  totalKills: number;
  soundEnabled: boolean;
  version: 2;

  // Legacy M6 fields preserved for backward-compatibility
  highestUnlockedLevel: number; // 1 to 5
  currentLevel: number;
  levelScores: Record<string | number, number>;
  levelStars: Record<string | number, number>; // levelId -> stars (1-3)
  soundMuted: boolean;
}

const STORAGE_KEY = 'swarm_gate_save_v1';

export const DEFAULT_SAVE_DATA: SaveData = {
  bestScore: 0,
  bestTimeSec: 0,
  totalKills: 0,
  soundEnabled: true,
  version: 2,
  highestUnlockedLevel: 1,
  currentLevel: 1,
  levelScores: {},
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

  public static sanitize(parsed: Record<string, unknown>): SaveData {
    // Migration: support both real M6 format and new Endless V2 schema
    let bestScore = Math.max(0, Number(parsed.bestScore) || 0);
    const bestTimeSec = Math.max(0, Number(parsed.bestTimeSec) || 0);
    const totalKills = Math.max(0, Number(parsed.totalKills) || 0);

    // If migrating from M6 save that had levelScores, convert total into initial score
    if (!parsed.version && parsed.levelScores && typeof parsed.levelScores === 'object') {
      let sumScores = 0;
      for (const val of Object.values(parsed.levelScores as Record<string, unknown>)) {
        sumScores += Number(val) || 0;
      }
      bestScore = Math.max(bestScore, sumScores);
    }

    const soundEnabled =
      parsed.soundEnabled !== undefined
        ? Boolean(parsed.soundEnabled)
        : parsed.soundMuted !== undefined
        ? !Boolean(parsed.soundMuted)
        : true;

    return {
      bestScore,
      bestTimeSec,
      totalKills,
      soundEnabled,
      version: 2,
      highestUnlockedLevel: Math.max(1, Math.min(5, Number(parsed.highestUnlockedLevel) || 1)),
      currentLevel: Math.max(1, Math.min(5, Number(parsed.currentLevel) || 1)),
      levelScores:
        typeof parsed.levelScores === 'object' && parsed.levelScores !== null
          ? (parsed.levelScores as Record<string | number, number>)
          : {},
      levelStars:
        typeof parsed.levelStars === 'object' && parsed.levelStars !== null
          ? (parsed.levelStars as Record<string | number, number>)
          : {},
      soundMuted: !soundEnabled
    };
  }

  /**
   * Records completed endless run, updating best score, best survival time, and kill tally.
   */
  public static async recordRun(
    score: number,
    survivalSeconds: number,
    kills: number
  ): Promise<{ isNewBestScore: boolean; isNewBestTime: boolean; data: SaveData }> {
    const isNewBestScore = score > this.cachedData.bestScore;
    const isNewBestTime = survivalSeconds > this.cachedData.bestTimeSec;

    const updated = await this.save({
      bestScore: Math.max(this.cachedData.bestScore, score),
      bestTimeSec: Math.max(this.cachedData.bestTimeSec, survivalSeconds),
      totalKills: this.cachedData.totalKills + kills
    });

    return { isNewBestScore, isNewBestTime, data: updated };
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
    const mergedUpdates = { ...updates };
    if (mergedUpdates.soundMuted !== undefined && mergedUpdates.soundEnabled === undefined) {
      mergedUpdates.soundEnabled = !mergedUpdates.soundMuted;
    } else if (mergedUpdates.soundEnabled !== undefined && mergedUpdates.soundMuted === undefined) {
      mergedUpdates.soundMuted = !mergedUpdates.soundEnabled;
    }

    this.cachedData = {
      ...this.cachedData,
      ...mergedUpdates
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
