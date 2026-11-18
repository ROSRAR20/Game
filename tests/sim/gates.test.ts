import { describe, it, expect } from 'vitest';
import {
  calculateGateOutput,
  createGate,
  GateManager
} from '../../src/sim/gates';
import { createMobPool, spawnMob, despawnMob } from '../../src/sim/pool';
import { SeededRNG } from '../../src/sim/rng';
import { CONFIG } from '../../src/config/constants';

describe('Milestone M2 Gates & Clone Math', () => {
  describe('Pure Math Function (calculateGateOutput)', () => {
    it('correctly calculates addition (+N)', () => {
      expect(calculateGateOutput('add', 5, 1)).toBe(6);
      expect(calculateGateOutput('add', 10, 1)).toBe(11);
      expect(calculateGateOutput('add', 20, 15)).toBe(35);
    });

    it('correctly calculates multiplier (xN)', () => {
      expect(calculateGateOutput('mul', 3, 1)).toBe(3);
      expect(calculateGateOutput('mul', 4, 3)).toBe(12);
      expect(calculateGateOutput('mul', 5, 10)).toBe(50);
    });

    it('correctly calculates compound multiplier progression (x3 then x4)', () => {
      const step1 = calculateGateOutput('mul', 3, 1); // 1 -> 3
      expect(step1).toBe(3);
      const step2 = calculateGateOutput('mul', 4, step1); // 3 -> 12
      expect(step2).toBe(12);
    });

    it('correctly calculates subtraction (-N)', () => {
      expect(calculateGateOutput('sub', 5, 10)).toBe(5);
      expect(calculateGateOutput('sub', 15, 10)).toBe(0); // clamped at 0
    });

    it('correctly calculates division (/N)', () => {
      expect(calculateGateOutput('div', 2, 10)).toBe(5);
      expect(calculateGateOutput('div', 3, 10)).toBe(3); // floor
      expect(calculateGateOutput('div', 2, 1)).toBe(0);
    });
  });

  describe('Gate Simulation & Clone Behavior', () => {
    it('clones inherit lastGateId and spawn just past gate plane (z = z_gate + 0.1)', () => {
      const rng = new SeededRNG(12345);
      const pool = createMobPool(100);
      const gateManager = new GateManager(rng);

      // Gate at Z = 20, width 6, kind = 'mul', value = 3
      const gate = createGate(101, 'mul', 3, 0, 6, 20);
      gateManager.setGates([gate]);

      // Spawn 1 unit just before gate plane (Z = 19.8, vz = 12)
      const slot = spawnMob(pool, 0, 19.8, 0, 12, 0);
      expect(pool.count).toBe(1);
      expect(pool.lastGateId[slot]).toBe(-1);

      // Step simulation by dt = 1/60 (moves Z from 19.8 to 20.0, crossing Z = 20)
      pool.z[slot] += pool.vz[slot] * (1 / 60);
      gateManager.update(pool, 1 / 60);

      // Original unit (1) + 2 clones = 3 units
      expect(pool.count).toBe(3);

      // The passing original unit must have lastGateId === gate.id
      expect(pool.lastGateId[slot]).toBe(101);

      // All newly spawned clones must strictly inherit lastGateId and spawn at z = 20 + 0.1
      for (let i = 0; i < pool.count; i++) {
        const s = pool.activeIndices[i];
        expect(pool.lastGateId[s]).toBe(101);
        if (s !== slot) {
          // Clone unit
          expect(pool.z[s]).toBeCloseTo(20 + CONFIG.GATES.PLANE_OFFSET_Z, 2);
          expect(pool.z[s]).toBeGreaterThan(20);
        }
      }
    });

    it('compound gates: 1 unit passing x3 then x4 produces exactly 12 units', () => {
      const rng = new SeededRNG(999);
      const pool = createMobPool(200);
      const gateManager = new GateManager(rng);

      const gate1 = createGate(1, 'mul', 3, 0, 10, 20);
      const gate2 = createGate(2, 'mul', 4, 0, 10, 40);
      gateManager.setGates([gate1, gate2]);

      // Spawn 1 player unit at Z = 19.8
      const slot = spawnMob(pool, 0, 19.8, 0, 12, 0);

      // 1. Cross first gate (Z = 20)
      pool.z[slot] = 20.0;
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBe(3); // 1 -> 3

      // Verify all 3 have lastGateId === 1
      for (let i = 0; i < pool.count; i++) {
        expect(pool.lastGateId[pool.activeIndices[i]]).toBe(1);
      }

      // 2. Advance all 3 units to cross gate 2 (Z = 40)
      for (let i = 0; i < pool.count; i++) {
        const s = pool.activeIndices[i];
        pool.z[s] = 40.0;
      }
      gateManager.update(pool, 1 / 60);

      // Each of the 3 units spawns (4 - 1) = 3 clones -> 3 + 9 = 12 total units
      expect(pool.count).toBe(12);

      // Verify all 12 units now have lastGateId === 2
      for (let i = 0; i < pool.count; i++) {
        expect(pool.lastGateId[pool.activeIndices[i]]).toBe(2);
      }
    });

    it('does not retrigger the same gate once passed', () => {
      const rng = new SeededRNG(42);
      const pool = createMobPool(100);
      const gateManager = new GateManager(rng);

      const gate = createGate(5, 'mul', 2, 0, 10, 30);
      gateManager.setGates([gate]);

      const slot = spawnMob(pool, 0, 29.9, 0, 12, 0);

      // Pass gate
      pool.z[slot] = 30.1;
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBe(2);

      // Step again while still near gate plane
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBe(2); // No extra clones
    });

    it('resets lastGateId to -1 when a pool slot is despawned and reused', () => {
      const pool = createMobPool(10);

      // Spawn and assign gate ID
      const slot = spawnMob(pool, 0, 10, 0, 12, 0, 0, 1, 1, 1, 88);
      expect(pool.lastGateId[slot]).toBe(88);

      // Despawn slot
      despawnMob(pool, slot);
      expect(pool.lastGateId[slot]).toBe(-1);

      // Re-spawn into same slot without explicit gate ID
      const newSlot = spawnMob(pool, 1, 15, 0, 12, 0);
      expect(newSlot).toBe(slot);
      expect(pool.lastGateId[newSlot]).toBe(-1); // Clean slot
    });

    it('buffers excess clones when exceeding MAX_CLONES_PER_TICK', () => {
      const rng = new SeededRNG(100);
      const pool = createMobPool(500);
      const gateManager = new GateManager(rng);

      // Gate with huge multiplier (e.g. x100)
      const gate = createGate(9, 'mul', 100, 0, 10, 15);
      gateManager.setGates([gate]);

      const slot = spawnMob(pool, 0, 14.9, 0, 12, 0);
      pool.z[slot] = 15.0;

      // Tick 1: should spawn up to MAX_CLONES_PER_TICK (50) and buffer the rest
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBeLessThanOrEqual(51); // 1 original + 50 immediate
      expect(gateManager.getPendingBufferCount()).toBeGreaterThan(0);

      // Tick 2: drains next batch from buffer
      const prevCount = pool.count;
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBeGreaterThan(prevCount);
    });

    it('cap overflow uses weight increment when pool is full', () => {
      const rng = new SeededRNG(77);
      // Small pool of capacity 2
      const pool = createMobPool(2);
      const gateManager = new GateManager(rng);

      const gate = createGate(1, 'mul', 3, 0, 10, 10);
      gateManager.setGates([gate]);

      // Fill 1 slot
      const s0 = spawnMob(pool, 0, 9.9, 0, 12, 0);
      expect(pool.count).toBe(1);

      // Pass gate: requires 2 clones. Slot 1 allocated, then pool capacity reached!
      pool.z[s0] = 10.0;
      gateManager.update(pool, 1 / 60);

      // Pool count reaches exactly capacity (2), and weight is incremented for overflow
      expect(pool.count).toBe(2);
      const totalWeight = pool.weight[pool.activeIndices[0]] + pool.weight[pool.activeIndices[1]];
      expect(totalWeight).toBe(3); // 1 original + 2 clones represented
    });

    it('continuous stream passing +5 gate grants +5 clones for EVERY passing unit', () => {
      const rng = new SeededRNG(55);
      const pool = createMobPool(200);
      const gateManager = new GateManager(rng);

      // +5 gate at Z = 25
      const gate = createGate(1, 'add', 5, -3, 6, 25);
      gateManager.setGates([gate]);

      // 10 consecutive units pass through +5 gate one after another
      for (let u = 0; u < 10; u++) {
        const slot = spawnMob(pool, -3, 24.8, 0, 12, 0);
        pool.z[slot] = 25.1; // Cross gate
        gateManager.update(pool, 1 / 60);
      }

      // 10 units * 6 (1 original + 5 clones each) = 60 units total
      expect(pool.count).toBe(60);
    });

    it('continuous stream passing x2 gate doubles EVERY passing unit', () => {
      const rng = new SeededRNG(88);
      const pool = createMobPool(200);
      const gateManager = new GateManager(rng);

      // x2 gate at Z = 25
      const gate = createGate(2, 'mul', 2, 3, 6, 25);
      gateManager.setGates([gate]);

      // 10 consecutive units pass through x2 gate one after another
      for (let u = 0; u < 10; u++) {
        const slot = spawnMob(pool, 3, 24.8, 0, 12, 0);
        pool.z[slot] = 25.1; // Cross gate
        gateManager.update(pool, 1 / 60);
      }

      // 10 units * 2 (1 original + 1 clone each) = 20 units total
      expect(pool.count).toBe(20);
    });

    it('chain of 3 add-1 gates turns 1 unit into 8 (clone cap off)', () => {
      const rng = new SeededRNG(999);
      const pool = createMobPool(100);
      const gateManager = new GateManager(rng);

      // 3 consecutive add-1 gates at Z = 10, Z = 15, Z = 20
      const g1 = createGate(11, 'add', 1, -5.1, 1.8, 10);
      const g2 = createGate(12, 'add', 1, -5.1, 1.8, 15);
      const g3 = createGate(13, 'add', 1, -5.1, 1.8, 20);
      gateManager.setGates([g1, g2, g3]);

      // Spawn 1 unit before gate 1
      spawnMob(pool, -5.1, 9.8, 0, 12, 0);
      expect(pool.count).toBe(1);

      // Pass Gate 1 (Z = 10): 1 unit in -> 2 units out (1 original + 1 clone)
      for (let i = 0; i < pool.count; i++) {
        pool.z[pool.activeIndices[i]] = 10.2;
      }
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBe(2);

      // Pass Gate 2 (Z = 15): 2 units in -> 4 units out
      for (let i = 0; i < pool.count; i++) {
        pool.z[pool.activeIndices[i]] = 15.2;
      }
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBe(4);

      // Pass Gate 3 (Z = 20): 4 units in -> 8 units out
      for (let i = 0; i < pool.count; i++) {
        const slot = pool.activeIndices[i];
        pool.z[slot] = 20.1;
      }
      gateManager.update(pool, 1 / 60);
      expect(pool.count).toBe(8);
    });
  });
});
