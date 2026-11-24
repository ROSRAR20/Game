import { describe, it, expect } from 'vitest';
import { PanelManager } from '../../src/sim/panels';
import { CannonSim } from '../../src/sim/cannon';
import { createMobPool, spawnMob } from '../../src/sim/pool';
import { GateManager, Gate } from '../../src/sim/gates';
import { SeededRNG } from '../../src/sim/rng';
import { CONFIG } from '../../src/config/constants';

describe('Stage 3: Cap Weight Merging & Moving +1 Panels', () => {
  describe('Cap Behaviour Option 1: Weight Merging (pool.count >= 3000)', () => {
    it('spawns clones normally when pool count is below 3000 threshold', () => {
      const pool = createMobPool(3500);
      const rng = new SeededRNG(42);
      const gates = new GateManager(rng);

      const mulGate: Gate = {
        id: 1,
        kind: 'mul',
        value: 3,
        x: 0,
        z: 18,
        width: 4,
        remainingValue: 3
      };
      gates.setGates([mulGate]);

      // Spawn 1 unit with weight 1
      const slot = spawnMob(pool, 0, 18.5, 0, 10, 0, 0, 1, 1, 1);
      expect(pool.count).toBe(1);
      expect(pool.weight[slot]).toBe(1);

      // Pass through gate (currZ = 18.5, vz = 10, dt = 0.1 -> prevZ = 17.5 <= 18 <= currZ)
      gates.update(pool, 0.1);

      // Desired strength: 1 * 3 = 3.
      // 2 clones spawned of weight 1 each, parent remains weight 1. Total weight = 3.
      expect(pool.count).toBe(3);
      expect(pool.weight[slot]).toBe(1);
      const clone1 = pool.activeIndices[1];
      const clone2 = pool.activeIndices[2];
      expect(pool.weight[clone1]).toBe(1);
      expect(pool.weight[clone2]).toBe(1);
    });

    it('merges clone multiplier into passing mob weight when pool count >= 3000 and conserves total strength', () => {
      const pool = createMobPool(3500);
      const rng = new SeededRNG(42);
      const gates = new GateManager(rng);

      // Pre-fill pool to 3,000 units
      for (let i = 0; i < 3000; i++) {
        spawnMob(pool, 0, 50, 0, 0, 1, 0, 1, 1, 1);
      }
      expect(pool.count).toBe(3000);

      // Spawn 1 passing unit with weight 1 crossing Z = 18
      const passingSlot = spawnMob(pool, 0, 18.5, 0, 10, 0, 0, 1, 1, 1);
      expect(pool.count).toBe(3001);

      const mulGate: Gate = {
        id: 2,
        kind: 'mul',
        value: 4, // Multiplier x4 requires 3 extra clones
        x: 0,
        z: 18,
        width: 4,
        remainingValue: 4
      };
      gates.setGates([mulGate]);

      // Unit passes gate when pool.count >= 3000
      const initialCount = pool.count;
      gates.update(pool, 0.1);

      // No new slots allocated because pool >= 3000
      expect(pool.count).toBe(initialCount);

      // Strength conservation: 1 unit + 3 clones = total strength 4
      // Passing unit weight absorbed all 3 clones -> weight 4
      expect(pool.weight[passingSlot]).toBe(4);
    });

    it('caps per-unit weight at MAX_UNIT_WEIGHT (10)', () => {
      const pool = createMobPool(3500);
      const rng = new SeededRNG(42);
      const gates = new GateManager(rng);

      for (let i = 0; i < 3000; i++) {
        spawnMob(pool, 0, 50, 0, 0, 1, 0, 1, 1, 1);
      }

      const passingSlot = spawnMob(pool, 0, 18.5, 0, 10, 0, 0, 1, 1, 5); // initial weight 5
      const mulGate: Gate = {
        id: 3,
        kind: 'mul',
        value: 10, // requires (10 - 1) * 5 = 45 extra clones
        x: 0,
        z: 18,
        width: 4,
        remainingValue: 10
      };
      gates.setGates([mulGate]);

      gates.update(pool, 0.1);

      // Clamped at MAX_UNIT_WEIGHT = 10
      expect(pool.weight[passingSlot]).toBe(CONFIG.CAP_MERGE.MAX_UNIT_WEIGHT);
    });
  });

  describe('Moving +1 Panels System', () => {
    it('produces deterministic identical spawns from identical seeds via dedicated RNG stream', () => {
      const p1 = new PanelManager(1234);
      const p2 = new PanelManager(1234);

      const panelA1 = p1.spawnPanel();
      const panelA2 = p2.spawnPanel();

      expect(panelA1.x).toBeCloseTo(panelA2.x, 5);
      expect(panelA1.z).toBeCloseTo(panelA2.z, 5);
      expect(panelA1.speed).toBe(CONFIG.PANELS.SPEED);

      const panelB1 = p1.spawnPanel();
      const panelB2 = p2.spawnPanel();
      expect(panelB1.x).toBeCloseTo(panelB2.x, 5);
      expect(panelB1.z).toBeCloseTo(panelB2.z, 5);
    });

    it('moves at 2.0 m/s toward cannon line and despawns at Z <= 5.0 without penalty', () => {
      const pm = new PanelManager(42);
      const cannon = new CannonSim();
      cannon.x = 0; // cannon at X=0, panel at X=4.0 -> no collision

      const panel = pm.spawnPanel();
      expect(panel.z).toBe(CONFIG.PANELS.SPAWN_Z); // 22.0
      expect(panel.speed).toBe(2.0);

      // Step 5 seconds (5 * 2.0 m/s = 10m traveled -> Z = 12.0)
      pm.update(5.0, 0, cannon);
      expect(pm.panels.length).toBe(1);
      expect(pm.panels[0].z).toBeCloseTo(12.0, 1);

      // Step another 4 seconds (Z = 4.0 <= 5.0 -> despawns)
      pm.update(4.0, 0, cannon);
      expect(pm.panels.length).toBe(0);
    });

    it('collects ONLY when the cannon cluster touches it (shots pass through)', () => {
      const pm = new PanelManager(42);
      const cannon = new CannonSim();
      cannon.setCannonCount(1);
      cannon.x = 0; // Centre lane

      const panel = pm.spawnPanel();
      panel.z = CONFIG.CANNON_Z; // at cannon line Z = 5.0, but X = 4.0

      // Cannon at X = 0 does NOT touch panel at X = 4.0
      const resMiss = pm.update(0.01, 0, cannon);
      expect(resMiss.collectedCount).toBe(0);
      expect(cannon.cannonCount).toBe(1);

      // Steer cannon into Left Lane (X = 4.0)
      cannon.x = 4.0;
      cannon.setTargetX(4.0);
      const resHit = pm.update(0.01, 0, cannon);
      expect(resHit.collectedCount).toBe(1);
      expect(resHit.newShooterCount).toBe(2);
      expect(cannon.cannonCount).toBe(2);
    });

    it('grants +250 score when panel is collected at max cannon cap (6 shooters)', () => {
      const pm = new PanelManager(42);
      const cannon = new CannonSim();
      cannon.setCannonCount(6);
      cannon.x = 4.0;

      const panel = pm.spawnPanel();
      panel.z = CONFIG.CANNON_Z;

      const res = pm.update(0.01, 0, cannon);
      expect(res.collectedCount).toBe(1);
      expect(res.newShooterCount).toBe(6);
      expect(res.bonusScoreAwarded).toBe(250);
      expect(cannon.cannonCount).toBe(6);
    });
  });

  describe('Cluster Lateral Extent & Lane Edge Collision', () => {
    it('computes exact cluster lateral bounds for count 1 (width 1.5) and count 6 (width 3.5)', () => {
      const cannon = new CannonSim();
      cannon.x = 0;

      cannon.setCannonCount(1);
      const b1 = cannon.getClusterBounds();
      expect(b1.minX).toBeCloseTo(-0.75, 2);
      expect(b1.maxX).toBeCloseTo(0.75, 2);
      expect(b1.maxX - b1.minX).toBeCloseTo(1.5, 2);

      cannon.setCannonCount(6);
      const b6 = cannon.getClusterBounds();
      // offsets: [-1.0, ..., 1.0], halfWidth = 0.75 -> span [-1.75, 1.75]
      expect(b6.minX).toBeCloseTo(-1.75, 2);
      expect(b6.maxX).toBeCloseTo(1.75, 2);
      expect(b6.maxX - b6.minX).toBeCloseTo(3.5, 2);
    });

    it('demonstrates wider formation catching lane-edge panels that a single shooter misses', () => {
      const pm = new PanelManager(42);
      const cannon = new CannonSim();

      // Cannon positioned at lane boundary X = 2.0
      cannon.x = 2.0;

      // Panel at X = 4.0 (half-width 0.7 -> span [3.3, 4.7]), Z = CANNON_Z
      // Count 1: span is [1.25, 2.75] -> maxX 2.75 < 3.3 -> misses
      // Count 6: span is [0.25, 3.75] -> maxX 3.75 >= 3.3 -> touches!

      // Test with Count 1:
      cannon.setCannonCount(1);
      pm.reset();
      const p1 = pm.spawnPanel();
      p1.x = 4.0;
      p1.z = CONFIG.CANNON_Z;
      const res1 = pm.update(0.01, 0, cannon);
      expect(res1.collectedCount).toBe(0); // Count 1 misses

      // Test with Count 6:
      cannon.setCannonCount(6);
      pm.reset();
      const p2 = pm.spawnPanel();
      p2.x = 4.0;
      p2.z = CONFIG.CANNON_Z;
      const res6 = pm.update(0.01, 0, cannon);
      expect(res6.collectedCount).toBe(1); // Count 6 touches!
    });
  });
});
