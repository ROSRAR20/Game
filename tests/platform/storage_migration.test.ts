import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/platform/storage';

describe('Save Migration (Amendment 3: Real M6 Save Schema -> Endless V2)', () => {
  beforeEach(async () => {
    // Reset to defaults
    await SaveManager.save({
      bestScore: 0,
      bestTimeSec: 0,
      totalKills: 0,
      soundEnabled: true,
      version: 2
    });
  });

  it('migrates a real M6 save JSON without crashing and preserves settings and progress', () => {
    // Real M6 save fixture containing campaign progression
    const realM6SaveJson = {
      highestUnlockedLevel: 3,
      currentLevel: 2,
      levelScores: { '1': 1200, '2': 2450 },
      levelStars: { '1': 3, '2': 2 },
      soundEnabled: true
    };

    const migrated = SaveManager.sanitize(realM6SaveJson);

    // Assert Endless V2 fields initialized
    expect(migrated.version).toBe(2);
    expect(migrated.bestScore).toBe(3650); // Converted sum of M6 level scores
    expect(migrated.bestTimeSec).toBe(0);
    expect(migrated.totalKills).toBe(0);
    expect(migrated.soundEnabled).toBe(true);
    expect(migrated.soundMuted).toBe(false);

    // Assert legacy fields preserved intact
    expect(migrated.highestUnlockedLevel).toBe(3);
    expect(migrated.currentLevel).toBe(2);
    expect(migrated.levelStars['1']).toBe(3);
    expect(migrated.levelStars['2']).toBe(2);
  });

  it('correctly handles soundMuted boolean from older milestones', () => {
    const legacyMutedSave = {
      highestUnlockedLevel: 1,
      currentLevel: 1,
      levelStars: {},
      soundMuted: true
    };

    const migrated = SaveManager.sanitize(legacyMutedSave);
    expect(migrated.soundEnabled).toBe(false);
    expect(migrated.soundMuted).toBe(true);
  });

  it('records endless runs and updates high scores and survival times', async () => {
    const res1 = await SaveManager.recordRun(1500, 145, 80);
    expect(res1.isNewBestScore).toBe(true);
    expect(res1.isNewBestTime).toBe(true);
    expect(SaveManager.get().bestScore).toBe(1500);
    expect(SaveManager.get().bestTimeSec).toBe(145);
    expect(SaveManager.get().totalKills).toBe(80);

    // Second run with lower score: does not overwrite best
    const res2 = await SaveManager.recordRun(800, 180, 45);
    expect(res2.isNewBestScore).toBe(false);
    expect(res2.isNewBestTime).toBe(true); // Longer survival time
    expect(SaveManager.get().bestScore).toBe(1500);
    expect(SaveManager.get().bestTimeSec).toBe(180);
    expect(SaveManager.get().totalKills).toBe(125);
  });
});
