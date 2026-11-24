import { describe, it, expect } from 'vitest';
import { validateLevel, getLevel1Data, getLevelGates } from '../../src/data/level';
import { CONFIG } from '../../src/config/constants';

describe('Level Data & Zod Validation (M4)', () => {
  it('validates bundled Level 1 data successfully', () => {
    const level = getLevel1Data();
    expect(level.id).toBe(1);
    expect(level.name).toBe('Desert Outpost');
    expect(level.gates.length).toBe(5);
    expect(level.towers.length).toBe(3);
    expect(level.bosses.length).toBe(1);
    expect(level.waves.length).toBe(3);

    const gates = getLevelGates();
    expect(gates.length).toBe(5);
  });

  it('rejects level if tower coordinates exceed road boundary', () => {
    const level = getLevel1Data();
    const invalidLevel = {
      ...level,
      towers: [
        {
          id: 1,
          x: CONFIG.ROAD_X_MAX + 5.0, // out of road bounds
          z: 50.0,
          radius: 1.0,
          maxHp: 50,
          rewardType: 'burst_units',
          rewardValue: 20
        }
      ]
    };

    expect(() => validateLevel(invalidLevel)).toThrow();
  });

  it('rejects level with duplicate entity IDs', () => {
    const level = getLevel1Data();
    const duplicateTowers = {
      ...level,
      towers: [
        {
          id: 1,
          x: 0,
          z: 30,
          radius: 1.0,
          maxHp: 50,
          rewardType: 'burst_units',
          rewardValue: 20
        },
        {
          id: 1, // duplicate id
          x: 0,
          z: 60,
          radius: 1.0,
          maxHp: 50,
          rewardType: 'burst_units',
          rewardValue: 20
        }
      ]
    };

    expect(() => validateLevel(duplicateTowers)).toThrow(/Entity IDs must be unique/);
  });
});
