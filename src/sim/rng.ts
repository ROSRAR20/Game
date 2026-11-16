/**
 * Deterministic 32-bit Mulberry32 Pseudo-Random Number Generator.
 * Pure TypeScript: zero dependencies, zero DOM, zero Three.js.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public getState(): number {
    return this.state;
  }

  /**
   * Generates a pseudo-random float in [0, 1).
   */
  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a pseudo-random integer in [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  /**
   * Generates a float in [min, max).
   */
  public nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }
}
