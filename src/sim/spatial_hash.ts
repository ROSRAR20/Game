import { CONFIG } from '../config/constants';

/**
 * Uniform Spatial Hash Grid for high-performance mob collision detection.
 * Uses structure-of-arrays integer linked lists (head & next) to achieve:
 * - O(1) cell insertion
 * - Zero allocations inside the frame loop
 * - No callback function overhead (iterated inline in combat loops)
 * - Deterministic slot iteration order
 */
export class SpatialHashGrid {
  public readonly cellSize: number;
  public readonly cols: number;
  public readonly rows: number;
  public readonly totalCells: number;

  private readonly xMin: number;
  private readonly xMax: number;
  private readonly zMin: number;
  private readonly zMax: number;

  // head[cellIdx] stores the slot index of the first unit in the cell (-1 if empty)
  public readonly head: Int32Array;

  // next[slot] stores the slot index of the next unit in the same cell (-1 if end of chain)
  public readonly next: Int32Array;

  constructor(
    cellSize: number = CONFIG.SPATIAL_HASH.CELL_SIZE,
    xMin: number = CONFIG.ROAD_X_MIN,
    xMax: number = CONFIG.ROAD_X_MAX,
    zMin: number = CONFIG.ROAD_Z_MIN,
    zMax: number = CONFIG.ROAD_Z_MAX,
    maxUnits: number = CONFIG.MAX_UNITS
  ) {
    this.cellSize = cellSize;
    this.xMin = xMin;
    this.xMax = xMax;
    this.zMin = zMin;
    this.zMax = zMax;

    this.cols = Math.ceil((xMax - xMin) / cellSize);
    this.rows = Math.ceil((zMax - zMin) / cellSize);
    this.totalCells = this.cols * this.rows;

    this.head = new Int32Array(this.totalCells);
    this.next = new Int32Array(maxUnits);

    this.clear();
  }

  /**
   * Resets all cell linked lists. Must be called once at the start of each combat tick.
   * head.fill(-1) performs a fast block-fill with zero allocations.
   */
  public clear(): void {
    this.head.fill(-1);
    this.next.fill(-1);
  }

  /**
   * Computes the grid column and row for a world coordinate (x, z),
   * strictly clamping coordinates to valid grid boundaries.
   */
  public getCellCoord(
    x: number,
    z: number
  ): { col: number; row: number; cellIdx: number } {
    // Clamp to [min, max - epsilon] so edge coordinates never exceed grid bounds
    const clampedX = Math.max(this.xMin, Math.min(this.xMax - 0.0001, x));
    const clampedZ = Math.max(this.zMin, Math.min(this.zMax - 0.0001, z));

    const col = Math.min(
      this.cols - 1,
      Math.max(0, Math.floor((clampedX - this.xMin) / this.cellSize))
    );
    const row = Math.min(
      this.rows - 1,
      Math.max(0, Math.floor((clampedZ - this.zMin) / this.cellSize))
    );
    const cellIdx = row * this.cols + col;

    return { col, row, cellIdx };
  }

  /**
   * Computes the 1D cell index for world coordinate (x, z).
   */
  public getCellIndex(x: number, z: number): number {
    const clampedX = Math.max(this.xMin, Math.min(this.xMax - 0.0001, x));
    const clampedZ = Math.max(this.zMin, Math.min(this.zMax - 0.0001, z));

    const col = Math.min(
      this.cols - 1,
      Math.max(0, Math.floor((clampedX - this.xMin) / this.cellSize))
    );
    const row = Math.min(
      this.rows - 1,
      Math.max(0, Math.floor((clampedZ - this.zMin) / this.cellSize))
    );
    return row * this.cols + col;
  }

  /**
   * Computes the 1D cell index directly from column and row.
   */
  public getCellIndexByCoord(col: number, row: number): number {
    return row * this.cols + col;
  }

  /**
   * Inserts unit at slot index into the spatial hash cell corresponding to (x, z).
   * Prepends to the linked list in O(1) time.
   */
  public insert(slot: number, x: number, z: number): void {
    const cellIdx = this.getCellIndex(x, z);
    this.next[slot] = this.head[cellIdx];
    this.head[cellIdx] = slot;
  }

  /**
   * Returns the first unit slot in the cell linked list, or -1 if empty.
   */
  public getHead(cellIdx: number): number {
    return this.head[cellIdx];
  }

  /**
   * Returns the next unit slot in the linked list chain, or -1 if at the end.
   */
  public getNext(slot: number): number {
    return this.next[slot];
  }
}
