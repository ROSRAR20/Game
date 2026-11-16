import { describe, it, expect } from 'vitest';
import { createMobPool, spawnMob } from '../../src/sim/pool';
import { CombatResolver } from '../../src/sim/combat';
import { BaseDefense } from '../../src/sim/base';
import { CONFIG } from '../../src/config/constants';

describe('Combat Resolution & Base Defense (Milestone M3 Task 2)', () => {
  it('resolves mutual destruction for standard tier-0 units (w = 1, hp = 1)', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();

    // Spawn 1 Blue unit at (0, 10)
    const bSlot = spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 1);
    // Spawn 1 Red unit at (0, 10.2) - distance 0.2 < 0.50 contact diameter
    const rSlot = spawnMob(pool, 0, 10.2, 0, -4, 1, 0, 1, 1, 1);

    expect(pool.count).toBe(2);

    const stats = combat.resolveCombat(pool);

    expect(stats.blueKilled).toBe(1);
    expect(stats.redKilled).toBe(1);
    expect(pool.count).toBe(0);
    expect(pool.active[bSlot]).toBe(0);
    expect(pool.active[rSlot]).toBe(0);
  });

  it('resolves weighted combat: heavier Blue destroys lighter Red and decrements weight', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();

    // Blue with weight = 5
    const bSlot = spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 5);
    // Red with weight = 2
    const rSlot = spawnMob(pool, 0, 10.2, 0, -4, 1, 0, 1, 1, 2);

    const stats = combat.resolveCombat(pool);

    expect(stats.blueKilled).toBe(0);
    expect(stats.redKilled).toBe(1);
    expect(pool.count).toBe(1);
    expect(pool.active[bSlot]).toBe(1);
    expect(pool.weight[bSlot]).toBe(3); // 5 - 2 = 3
    expect(pool.active[rSlot]).toBe(0);
  });

  it('resolves weighted combat: heavier Red destroys lighter Blue and decrements weight', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();

    // Blue with weight = 2
    const bSlot = spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 2);
    // Red with weight = 5
    const rSlot = spawnMob(pool, 0, 10.2, 0, -4, 1, 0, 1, 1, 5);

    const stats = combat.resolveCombat(pool);

    expect(stats.blueKilled).toBe(1);
    expect(stats.redKilled).toBe(0);
    expect(pool.count).toBe(1);
    expect(pool.active[bSlot]).toBe(0);
    expect(pool.active[rSlot]).toBe(1);
    expect(pool.weight[rSlot]).toBe(3); // 5 - 2 = 3
  });

  it('resolves equal weight destruction (wb == wr)', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();

    // Both weight = 4
    const bSlot = spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 4);
    const rSlot = spawnMob(pool, 0, 10.1, 0, -4, 1, 0, 1, 1, 4);

    const stats = combat.resolveCombat(pool);

    expect(stats.blueKilled).toBe(1);
    expect(stats.redKilled).toBe(1);
    expect(pool.count).toBe(0);
    expect(pool.active[bSlot]).toBe(0);
    expect(pool.active[rSlot]).toBe(0);
  });

  it('resolves multi-contact combat up to max contacts limit', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();

    // Blue with weight = 3
    const bSlot = spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 3);
    // Three Red units with weight = 1 near Blue
    const r1 = spawnMob(pool, 0.1, 10.1, 0, -4, 1, 0, 1, 1, 1);
    const r2 = spawnMob(pool, -0.1, 10.1, 0, -4, 1, 0, 1, 1, 1);
    const r3 = spawnMob(pool, 0, 10.2, 0, -4, 1, 0, 1, 1, 1);

    const stats = combat.resolveCombat(pool);

    // Blue destroyed all three red units, and its own weight reached 0 (mutual destruction on 3rd)
    expect(stats.redKilled).toBe(3);
    expect(stats.blueKilled).toBe(1);
    expect(pool.count).toBe(0);
    expect(pool.active[bSlot]).toBe(0);
    expect(pool.active[r1]).toBe(0);
    expect(pool.active[r2]).toBe(0);
    expect(pool.active[r3]).toBe(0);
  });

  it('does not trigger combat for units outside contact radius', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();

    // Distance = 1.0 > 0.50
    spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 1);
    spawnMob(pool, 0, 11, 0, -4, 1, 0, 1, 1, 1);

    const stats = combat.resolveCombat(pool);

    expect(stats.blueKilled).toBe(0);
    expect(stats.redKilled).toBe(0);
    expect(pool.count).toBe(2);
  });

  it('damages base and despawns red units reaching Z <= BASE_Z (0)', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();
    const base = new BaseDefense(100);

    // Red unit breaching at Z = 0 with weight 5
    const rSlot = spawnMob(pool, 1.0, 0.0, 0, -4, 1, 0, 1, 1, 5);
    // Blue unit at Z = -1 (e.g. cannon area) should not damage base
    const bSlot = spawnMob(pool, 0.0, -1.0, 0, 12, 0, 0, 1, 1, 1);

    const dmg = combat.checkBaseBreaches(pool, base);

    expect(dmg).toBe(5 * CONFIG.RED_MOB_BASE_DAMAGE);
    expect(base.hp).toBe(95);
    expect(base.isGameOver).toBe(false);
    expect(pool.active[rSlot]).toBe(0); // Red despawned
    expect(pool.active[bSlot]).toBe(1); // Blue untouched
  });

  it('triggers Game Over when base HP reaches 0', () => {
    const pool = createMobPool(100);
    const combat = new CombatResolver();
    const base = new BaseDefense(20);

    // Red unit with weight 25 breaches base with 20 HP
    spawnMob(pool, 0, -0.5, 0, -4, 1, 0, 1, 1, 25);

    combat.checkBaseBreaches(pool, base);

    expect(base.hp).toBe(0);
    expect(base.isGameOver).toBe(true);
  });

  it('resets base defense cleanly on restart', () => {
    const base = new BaseDefense(100);

    base.takeDamage(100);
    expect(base.hp).toBe(0);
    expect(base.isGameOver).toBe(true);

    base.reset();
    expect(base.hp).toBe(100);
    expect(base.isGameOver).toBe(false);
  });
});
