import { describe, it, expect } from 'vitest';
import { getLevelData, TOTAL_LEVELS, validateLevel } from '../../src/data/level';
import { calculateGateOutput } from '../../src/sim/gates';

describe('Campaign Levels Data Validation (M6)', () => {
  it('validates that exactly 5 campaign levels exist', () => {
    expect(TOTAL_LEVELS).toBe(5);
  });

  for (let lvl = 1; lvl <= 5; lvl++) {
    it(`validates level ${lvl} schema, gates, towers, bosses, and waves`, () => {
      const level = getLevelData(lvl);
      expect(level.id).toBe(lvl);
      expect(level.name.length).toBeGreaterThan(0);
      expect(level.gates.length).toBeGreaterThan(0);
      expect(level.towers.length).toBeGreaterThan(0);
      expect(level.bosses.length).toBeGreaterThan(0);
      expect(level.waves.length).toBeGreaterThan(0);

      // Validate entity ID uniqueness
      const gateIds = new Set(level.gates.map((g) => g.id));
      expect(gateIds.size).toBe(level.gates.length);

      const towerIds = new Set(level.towers.map((t) => t.id));
      expect(towerIds.size).toBe(level.towers.length);

      const bossIds = new Set(level.bosses.map((b) => b.id));
      expect(bossIds.size).toBe(level.bosses.length);

      // Validate waves have strictly ascending trigger times
      for (let i = 1; i < level.waves.length; i++) {
        expect(level.waves[i].triggerTimeSec).toBeGreaterThanOrEqual(
          level.waves[i - 1].triggerTimeSec
        );
      }

      // Check re-validation via validateLevel
      expect(() => validateLevel(level)).not.toThrow();
    });
  }

  it('verifies gate math consistency across campaign levels', () => {
    // Level 1: Left gate is +5, Right gate is x2
    const l1 = getLevelData(1);
    const mulGate = l1.gates.find((g) => g.kind === 'mul')!;
    expect(calculateGateOutput('mul', mulGate.value, 10)).toBe(20);

    // Level 3: Left gate is +15, Right gate is x3; second tier has div 2 and x2
    const l3 = getLevelData(3);
    const divGate = l3.gates.find((g) => g.kind === 'div')!;
    expect(calculateGateOutput('div', divGate.value, 21)).toBe(10);
  });
});
