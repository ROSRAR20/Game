import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/sim/loop';
import { CONFIG } from '../../src/config/constants';

describe('Stage 5: Periodic Boss & Endless Integration', () => {
  it('keeps guardian towers disabled in endless mode and aligns ?startAt with no backlog burst', () => {
    const sim = new Simulation(42);
    sim.startEndless(125); // 2m05s -> 2 intervals passed (60s, 120s)

    expect(sim.towers.towers.length).toBe(0);
    expect(sim.bosses.bosses.length).toBe(0);
    expect(sim.endless.bossSpawnCount).toBe(2);
    expect(sim.endless.nextBossTimeSec).toBe(180); // Next upcoming boss is Boss #3 at t=180s

    // Step 1 tick -> should NOT spawn Boss #1 or #2 backlog
    sim.step(CONFIG.FIXED_DELTA_TIME);
    expect(sim.bosses.bosses.length).toBe(0);
  });

  it('spawns Periodic Boss 1 at t = 60s at Z = 34.0 with HP 120 and speed 0.7', () => {
    const sim = new Simulation(42);
    sim.startEndless(59.9);

    for (let i = 0; i < 10; i++) {
      sim.step(CONFIG.FIXED_DELTA_TIME);
    }

    expect(sim.bosses.bosses.length).toBe(1);
    const boss = sim.bosses.bosses[0];
    expect(boss.id).toBe(1);
    expect(boss.x).toBe(CONFIG.ENDLESS_BOSS.SPAWN_X);
    expect(boss.z).toBeCloseTo(CONFIG.ENDLESS_BOSS.SPAWN_Z, 0);
    expect(boss.maxHp).toBe(120);
    expect(boss.speed).toBe(0.7);
  });

  it('scales Boss N HP as 120 + (N - 1) * 160 and grants +20 HP (capped 100) + 1500 score on defeat', () => {
    const sim = new Simulation(42);
    sim.startEndless(59.9);
    sim.base.takeDamage(35); // Base HP = 65
    expect(sim.base.hp).toBe(65);

    // Trigger Boss #1 spawn
    for (let i = 0; i < 10; i++) {
      sim.step(CONFIG.FIXED_DELTA_TIME);
    }
    const boss1 = sim.bosses.bosses[0];
    expect(boss1.maxHp).toBe(120);

    const scoreBefore = sim.endless.getScore(sim.ticks);
    // Spawn a high-weight blue unit directly on boss1 to defeat it
    sim.spawnMob(boss1.x, boss1.z, 0, 0, 0, 2, 1, 2, 60);
    sim.step(CONFIG.FIXED_DELTA_TIME);

    expect(boss1.isDefeated).toBe(true);
    expect(sim.endless.bossesDefeated).toBe(1);
    expect(sim.base.hp).toBe(85); // 65 + 20 = 85
    expect(sim.endless.getScore(sim.ticks) - scoreBefore).toBeGreaterThanOrEqual(1500);

    // Test cap at maxHp (100) when defeating Boss #2 at t = 120s
    sim.endless.difficultyTime = 119.99;
    sim.step(CONFIG.FIXED_DELTA_TIME);
    const boss2 = sim.bosses.bosses.find((b) => b.id === 2)!;
    expect(boss2).toBeDefined();
    expect(boss2.maxHp).toBe(280);

    sim.spawnMob(boss2.x, boss2.z, 0, 0, 0, 2, 1, 2, 140);
    sim.step(CONFIG.FIXED_DELTA_TIME);
    expect(boss2.isDefeated).toBe(true);
    expect(sim.endless.bossesDefeated).toBe(2);
    expect(sim.base.hp).toBe(100); // 85 + 20 clamped to 100
  });

  it('deals 40 HP base breach damage if boss reaches Z <= 0 without granting defeat reward', () => {
    const sim = new Simulation(42);
    sim.startEndless(59.9);
    for (let i = 0; i < 10; i++) {
      sim.step(CONFIG.FIXED_DELTA_TIME);
    }
    const boss = sim.bosses.bosses[0];
    boss.z = 0.01;
    const scoreBefore = sim.endless.getScore(sim.ticks);

    sim.step(CONFIG.FIXED_DELTA_TIME);

    expect(boss.isDefeated).toBe(true);
    expect(sim.base.hp).toBe(60); // 100 - 40 = 60
    expect(sim.endless.bossesDefeated).toBe(0);
    expect(sim.endless.getScore(sim.ticks) - scoreBefore).toBeLessThan(1500);
  });
});
