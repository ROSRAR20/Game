import { CONFIG } from '../config/constants';

export class HudController {
  private baseHpText: HTMLElement | null = null;
  private baseHpFill: HTMLElement | null = null;
  private damageVignette: HTMLElement | null = null;
  private gameOverModal: HTMLElement | null = null;
  private restartBtn: HTMLElement | null = null;

  private lastHp: number = CONFIG.BASE_MAX_HP;
  private vignetteTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly onRestartCallback: () => void;

  constructor(onRestart: () => void) {
    this.onRestartCallback = onRestart;
    this.initDOM();
  }

  private initDOM(): void {
    if (typeof document === 'undefined') return;

    this.baseHpText = document.getElementById('base-hp-text');
    this.baseHpFill = document.getElementById('base-hp-fill');
    this.damageVignette = document.getElementById('damage-vignette');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.restartBtn = document.getElementById('btn-restart');

    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', () => {
        this.hideGameOver();
        this.onRestartCallback();
      });
    }
  }

  public update(baseHp: number, maxHp: number, isGameOver: boolean): void {
    // 1. Damage vignette flash effect when base takes damage
    if (baseHp < this.lastHp && this.damageVignette) {
      this.triggerDamageFlash();
    }
    this.lastHp = baseHp;

    // 2. Base HP bar text and fill
    if (this.baseHpText && this.baseHpFill) {
      const clampedHp = Math.max(0, Math.round(baseHp));
      this.baseHpText.textContent = `${clampedHp} / ${maxHp}`;

      const pct = Math.max(0, Math.min(100, (baseHp / maxHp) * 100));
      this.baseHpFill.style.width = `${pct}%`;

      if (pct <= 30) {
        this.baseHpFill.classList.add('danger');
      } else {
        this.baseHpFill.classList.remove('danger');
      }
    }

    // 3. Game Over modal presentation
    if (isGameOver) {
      this.showGameOver();
    } else {
      this.hideGameOver();
    }
  }

  private triggerDamageFlash(): void {
    if (!this.damageVignette) return;
    this.damageVignette.style.opacity = '1';

    if (this.vignetteTimeoutId !== null) {
      clearTimeout(this.vignetteTimeoutId);
    }

    this.vignetteTimeoutId = setTimeout(() => {
      if (this.damageVignette) {
        this.damageVignette.style.opacity = '0';
      }
      this.vignetteTimeoutId = null;
    }, 120);
  }

  public showGameOver(): void {
    if (this.gameOverModal && this.gameOverModal.style.display !== 'flex') {
      this.gameOverModal.style.display = 'flex';
    }
  }

  public hideGameOver(): void {
    if (this.gameOverModal && this.gameOverModal.style.display !== 'none') {
      this.gameOverModal.style.display = 'none';
    }
  }

  public reset(maxHp: number = CONFIG.BASE_MAX_HP): void {
    this.lastHp = maxHp;
    this.hideGameOver();
    if (this.damageVignette) {
      this.damageVignette.style.opacity = '0';
    }
    if (this.baseHpText && this.baseHpFill) {
      this.baseHpText.textContent = `${maxHp} / ${maxHp}`;
      this.baseHpFill.style.width = '100%';
      this.baseHpFill.classList.remove('danger');
    }
  }
}
