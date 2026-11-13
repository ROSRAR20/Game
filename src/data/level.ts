import { createGate, Gate } from '../sim/gates';

/**
 * Level 1 Gate Layout.
 * Pairs of gates positioned along the track, giving players clear strategic choices.
 */
export function getLevelGates(): Gate[] {
  return [
    // Gate Pair 1 at Z = 25
    createGate(1, 'add', 5, -2.8, 5.5, 25), // Left: +5
    createGate(2, 'mul', 2, 2.8, 5.5, 25),  // Right: x2

    // Gate Pair 2 at Z = 50
    createGate(3, 'mul', 3, -2.8, 5.5, 50), // Left: x3
    createGate(4, 'add', 10, 2.8, 5.5, 50), // Right: +10

    // Gate Pair 3 at Z = 75
    createGate(5, 'mul', 2, -2.8, 5.5, 75), // Left: x2
    createGate(6, 'mul', 4, 2.8, 5.5, 75)   // Right: x4
  ];
}
