import { describe, it, expect } from 'vitest';
import { SpatialHashGrid } from '../../src/sim/spatial_hash';
import { CONFIG } from '../../src/config/constants';

describe('SpatialHashGrid (Uniform Spatial Hash)', () => {
  it('initializes grid with configured dimensions and cell size', () => {
    const grid = new SpatialHashGrid();

    expect(grid.cellSize).toBe(CONFIG.SPATIAL_HASH.CELL_SIZE);
    expect(grid.cols).toBe(CONFIG.SPATIAL_HASH.COLS);
    expect(grid.rows).toBe(CONFIG.SPATIAL_HASH.ROWS);
    expect(grid.totalCells).toBe(CONFIG.SPATIAL_HASH.TOTAL_CELLS);

    // Initial state must be completely cleared (-1)
    for (let i = 0; i < grid.totalCells; i++) {
      expect(grid.getHead(i)).toBe(-1);
    }
  });

  it('inserts units and chains multiple slots in the same cell', () => {
    const grid = new SpatialHashGrid();

    // Insert slot 10 and slot 25 into the same location (x = 0, z = 10)
    grid.insert(10, 0, 10);
    grid.insert(25, 0, 10);

    const cellIdx = grid.getCellIndex(0, 10);
    expect(cellIdx).toBeGreaterThanOrEqual(0);
    expect(cellIdx).toBeLessThan(grid.totalCells);

    // Head points to the most recently inserted slot (25)
    expect(grid.getHead(cellIdx)).toBe(25);
    // Next of 25 points to previous slot (10)
    expect(grid.getNext(25)).toBe(10);
    // Next of 10 points to end of chain (-1)
    expect(grid.getNext(10)).toBe(-1);
  });

  it('clears all cell chains with zero allocations', () => {
    const grid = new SpatialHashGrid();

    grid.insert(5, 1, 20);
    grid.insert(8, -2, 45);

    const headRef = grid.head;
    const nextRef = grid.next;

    grid.clear();

    // Typed arrays retain identical buffer reference
    expect(grid.head).toBe(headRef);
    expect(grid.next).toBe(nextRef);

    // All heads reset to -1
    expect(grid.getHead(grid.getCellIndex(1, 20))).toBe(-1);
    expect(grid.getHead(grid.getCellIndex(-2, 45))).toBe(-1);
  });

  it('strictly clamps out-of-grid coordinates to valid cell indices', () => {
    const grid = new SpatialHashGrid();

    // Coordinates far beyond negative and positive road bounds
    const extremeCoords = [
      { x: -100, z: -500 },
      { x: 500, z: 1000 },
      { x: -6.0, z: 0.0 }, // exact min bounds
      { x: 6.0, z: 100.0 }, // exact max bounds
      { x: 0.0, z: 50.0 }, // center
      { x: -1000, z: 50.0 },
      { x: 0.0, z: -1000 }
    ];

    for (const c of extremeCoords) {
      const idx = grid.getCellIndex(c.x, c.z);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(grid.totalCells);
      expect(Number.isInteger(idx)).toBe(true);
      expect(Number.isNaN(idx)).toBe(false);

      const coord = grid.getCellCoord(c.x, c.z);
      expect(coord.col).toBeGreaterThanOrEqual(0);
      expect(coord.col).toBeLessThan(grid.cols);
      expect(coord.row).toBeGreaterThanOrEqual(0);
      expect(coord.row).toBeLessThan(grid.rows);
      expect(coord.cellIdx).toBe(idx);
    }
  });

  it('correctly maps distinct spatial coordinates to neighboring cells', () => {
    const grid = new SpatialHashGrid();

    // Two points separated by more than 1 cell size (0.8) along X
    const p1 = grid.getCellCoord(0, 10);
    const p2 = grid.getCellCoord(1.6, 10);

    expect(p2.col - p1.col).toBe(2);
    expect(p1.row).toBe(p2.row);

    // Two points separated by 1 cell along Z
    const p3 = grid.getCellCoord(0, 10 + grid.cellSize);
    expect(p3.row - p1.row).toBe(1);
    expect(p3.col).toBe(p1.col);
  });

  it('allows inline 3x3 neighborhood queries without callback allocations', () => {
    const grid = new SpatialHashGrid();

    // Insert 4 units in adjacent cells around center (col ~7, row ~25)
    grid.insert(1, 0, 20); // center
    grid.insert(2, 0.5, 20); // right neighbor
    grid.insert(3, -0.5, 20.5); // top-left neighbor
    grid.insert(4, 3.0, 50.0); // far away unit

    const center = grid.getCellCoord(0, 20);
    const minC = Math.max(0, center.col - 1);
    const maxC = Math.min(grid.cols - 1, center.col + 1);
    const minR = Math.max(0, center.row - 1);
    const maxR = Math.min(grid.rows - 1, center.row + 1);

    const foundSlots: number[] = [];

    // Traverse 3x3 neighborhood inline using head and next integer indices
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cellIdx = grid.getCellIndexByCoord(c, r);
        let slot = grid.getHead(cellIdx);
        while (slot !== -1) {
          foundSlots.push(slot);
          slot = grid.getNext(slot);
        }
      }
    }

    // Nearby units (1, 2, 3) must be found; far unit (4) must not
    expect(foundSlots).toContain(1);
    expect(foundSlots).toContain(2);
    expect(foundSlots).toContain(3);
    expect(foundSlots).not.toContain(4);
  });

  it('verifies the fast-mob head-on tunnelling guarantee under max configured speeds', () => {
    // Read configured speeds
    const blueSpeed = CONFIG.MOB_BASE_SPEED; // 12 units/sec (+Z)
    const redMaxSpeed = CONFIG.WAVES.MAX_SPEED; // 4 units/sec (-Z)
    const dt = CONFIG.FIXED_DELTA_TIME; // 1/60 sec
    const mobRadius = CONFIG.MOB_RADIUS; // 0.25 units
    const contactDiameter = 2 * mobRadius; // 0.50 units

    // Relative closing speed
    const relativeSpeed = blueSpeed + redMaxSpeed; // 16 units/sec
    const maxStepPerTick = relativeSpeed * dt; // 16 / 60 = 0.2667 units

    // Theoretical proof assertion:
    // Max movement per tick MUST be strictly less than the contact diameter
    expect(maxStepPerTick).toBeLessThan(contactDiameter);

    // Simulation verification across 100 continuous start offset phases:
    // Ensure that for ANY arbitrary starting distance, the two head-on units
    // will register distance <= contactDiameter in at least one tick.
    for (let phase = 0; phase < 100; phase++) {
      let blueZ = 10.0;
      // Vary initial distance continuously with fractional sub-step offsets
      let redZ = 10.0 + 15.0 + (phase / 100) * maxStepPerTick;

      let detectedContact = false;

      // Simulate step-by-step
      for (let tick = 0; tick < 120; tick++) {
        const dist = redZ - blueZ;

        if (dist <= contactDiameter && dist >= -contactDiameter) {
          detectedContact = true;
          break;
        }

        // If they have already passed each other without detection, failure
        if (dist < -contactDiameter) {
          break;
        }

        blueZ += blueSpeed * dt;
        redZ -= redMaxSpeed * dt;
      }

      expect(detectedContact).toBe(true);
    }
  });
});
