import { CONFIG } from '../config/constants';

export type BaseDamageCallback = (hpRemaining: number, damageTaken: number) => void;

/**
 * Base Defense and Lose State Manager.
 * Pure TypeScript: deterministic, no DOM, no Three.js.
 * Tracks base HP, handles breaching red mob damage, and triggers Game Over state.
 */
export class BaseDefense {
  public hp: number;
  public readonly maxHp: number;
  public isGameOver: boolean = false;
  private onDamageCallback?: BaseDamageCallback;

  constructor(maxHp: number = CONFIG.BASE_MAX_HP) {
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  public onDamage(callback: BaseDamageCallback): void {
    this.onDamageCallback = callback;
  }

  /**
   * Applies damage to base HP.
   * If HP reaches 0, sets isGameOver = true.
   */
  public takeDamage(amount: number): void {
    if (this.isGameOver || amount <= 0) return;

    this.hp = Math.max(0, this.hp - amount);
    if (this.onDamageCallback) {
      this.onDamageCallback(this.hp, amount);
    }

    if (this.hp === 0) {
      this.isGameOver = true;
    }
  }

  /**
   * Restores base HP up to maxHp (if not already game over).
   */
  public heal(amount: number): void {
    if (this.isGameOver || amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Resets base defense back to full health.
   */
  public reset(): void {
    this.hp = this.maxHp;
    this.isGameOver = false;
  }
}
