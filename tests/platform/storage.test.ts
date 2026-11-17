import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/platform/storage';

describe('SaveManager & Durable Preferences (M6)', () => {
  beforeEach(async () => {
    await SaveManager.reset();
  });

  it('loads default save data when storage is pristine', async () => {
    const data = await SaveManager.load();
    expect(data.highestUnlockedLevel).toBe(1);
    expect(data.currentLevel).toBe(1);
    expect(data.soundMuted).toBe(false);
    expect(data.levelStars).toEqual({});
  });

  it('persists updates and re-loads them correctly', async () => {
    await SaveManager.save({
      currentLevel: 3,
      soundMuted: true
    });

    const data = await SaveManager.load();
    expect(data.currentLevel).toBe(3);
    expect(data.soundMuted).toBe(true);
  });

  it('awards stars and unlocks next level upon completion', async () => {
    // Complete Level 1 with 100% Base HP -> 3 stars, unlocks Level 2
    const res1 = await SaveManager.completeLevel(1, 100);
    expect(res1.unlockedNewLevel).toBe(true);
    expect(res1.stars).toBe(3);
    expect(res1.highest).toBe(2);

    const saved = SaveManager.get();
    expect(saved.highestUnlockedLevel).toBe(2);
    expect(saved.levelStars[1]).toBe(3);

    // Replay Level 1 with 50% HP -> should retain 3 stars (max)
    const resReplay = await SaveManager.completeLevel(1, 50);
    expect(resReplay.unlockedNewLevel).toBe(false);
    expect(resReplay.stars).toBe(3);

    // Complete Level 2 -> unlocks Level 3
    const res2 = await SaveManager.completeLevel(2, 60);
    expect(res2.unlockedNewLevel).toBe(true);
    expect(res2.stars).toBe(2);
    expect(res2.highest).toBe(3);
  });

  it('does not advance past level 5', async () => {
    await SaveManager.save({ highestUnlockedLevel: 5 });
    const res = await SaveManager.completeLevel(5, 100);
    expect(res.unlockedNewLevel).toBe(false);
    expect(res.highest).toBe(5);
  });
});
