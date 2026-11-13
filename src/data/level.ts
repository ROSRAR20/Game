import { createGate, Gate } from '../sim/gates';

/**
 * Level 1 Gate Layout.
 * Pairs of gates positioned along the track, giving players clear strategic choices.
 * Road width is 12 (X from -6 to +6).
 * Left lane gate: x = -3.0, width = 6.0 (covers [-6, 0])
 * Right lane gate: x = +3.0, width = 6.0 (covers [0, 6])
 * Completely seamless coverage across the entire road width.
 */
export function getLevelGates(): Gate[] {
  return [
    // Gate Pair 1 at Z = 25: Left lane +5, Right lane x2
    createGate(1, 'add', 5, -3.0, 6.0, 25), // Left: +5
    createGate(2, 'mul', 2, 3.0, 6.0, 25),  // Right: x2

    // Gate Pair 2 at Z = 50: Left lane x3, Right lane +10
    createGate(3, 'mul', 3, -3.0, 6.0, 50), // Left: x3
    createGate(4, 'add', 10, 3.0, 6.0, 50), // Right: +10

    // Gate Pair 3 at Z = 75: Left lane x2, Right lane x4
    createGate(5, 'mul', 2, -3.0, 6.0, 75), // Left: x2
    createGate(6, 'mul', 4, 3.0, 6.0, 75)   // Right: x4
  ];
}
