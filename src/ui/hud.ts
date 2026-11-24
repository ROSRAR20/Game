import { CONFIG } from '../config/constants';
import { LevelData } from '../data/level';

export interface HudCallbacks {
  onRestart: () => void;
  onNextLevel: () => void;
  onOpenMenu: () => void;
}

export class HudController {
  private baseHpText: HTMLElement | null = null;
  private baseHpFill: HTMLElement | null = null;
  private damageVignette: HTMLElement | null = null;
  private gameOverModal: HTMLElement | null = null;
  private restartBtn: HTMLElement | null = null;
  private gameOverMenuBtn: HTMLElement | null = null;
  private victoryModal: HTMLElement | null = null;
  private replayBtn: HTMLElement | null = null;
  private nextLevelBtn: HTMLElement | null = null;
  private victoryMenuBtn: HTMLElement | null = null;
  private victoryBaseStatus: HTMLElement | null = null;
  private victoryStarsEl: HTMLElement | null = null;
  private objTowersEl: HTMLElement | null = null;
  private objBossEl: HTMLElement | null = null;
  private levelBadgeEl: HTMLElement | null = null;
  private levelTitleEl: HTMLElement | null = null;
  private btnPauseMenu: HTMLElement | null = null;
  private levelBannerEl: HTMLElement | null = null;
  private endlessBannerEl: HTMLElement | null = null;
  private hudEndlessTime: HTMLElement | null = null;
  private hudEndlessScore: HTMLElement | null = null;
  private hudEndlessBest: HTMLElement | null = null;
  private hudCannonCount: HTMLElement | null = null;
  private lastEndlessUpdateMs: number = 0;

  private lastHp: number = CONFIG.BASE_MAX_HP;
  private vignetteTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly callbacks: HudCallbacks;
  public currentLevelId: number = 1;

  constructor(callbacks: HudCallbacks) {
    this.callbacks = callbacks;
    this.initDOM();
  }

  private initDOM(): void {
    if (typeof document === 'undefined') return;

    this.baseHpText = document.getElementById('base-hp-text');
    this.baseHpFill = document.getElementById('base-hp-fill');
    this.damageVignette = document.getElementById('damage-vignette');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.restartBtn = document.getElementById('btn-restart');
    this.gameOverMenuBtn = document.getElementById('btn-gameover-menu');
    this.victoryModal = document.getElementById('victory-modal');
    this.replayBtn = document.getElementById('btn-replay');
    this.nextLevelBtn = document.getElementById('btn-next-level');
    this.victoryMenuBtn = document.getElementById('btn-victory-menu');
    this.victoryBaseStatus = document.getElementById('v-base-status');
    this.victoryStarsEl = document.getElementById('v-stars');
    this.objTowersEl = document.getElementById('obj-towers');
    this.objBossEl = document.getElementById('obj-boss');
    this.levelBadgeEl = document.getElementById('hud-level-badge');
    this.levelTitleEl = document.getElementById('hud-level-title');
    this.btnPauseMenu = document.getElementById('btn-pause-menu');
    this.levelBannerEl = document.getElementById('level-banner');
    this.endlessBannerEl = document.getElementById('endless-hud-banner');
    this.hudEndlessTime = document.getElementById('hud-endless-time');
    this.hudEndlessScore = document.getElementById('hud-endless-score');
    this.hudEndlessBest = document.getElementById('hud-endless-best');
    this.hudCannonCount = document.getElementById('hud-cannon-count');

    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', () => {
        this.hideGameOver();
        this.callbacks.onRestart();
      });
    }

    if (this.gameOverMenuBtn) {
      this.gameOverMenuBtn.addEventListener('click', () => {
        this.hideGameOver();
        this.callbacks.onOpenMenu();
      });
    }

    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => {
        this.hideVictory();
        this.callbacks.onRestart();
      });
    }

    if (this.nextLevelBtn) {
      this.nextLevelBtn.addEventListener('click', () => {
        this.hideVictory();
        this.callbacks.onNextLevel();
      });
    }

    if (this.victoryMenuBtn) {
      this.victoryMenuBtn.addEventListener('click', () => {
        this.hideVictory();
        this.callbacks.onOpenMenu();
      });
    }

    if (this.btnPauseMenu) {
      this.btnPauseMenu.addEventListener('click', () => {
        this.callbacks.onOpenMenu();
      });
    }
  }

  public setEndlessMode(isEndless: boolean): void {
    if (this.endlessBannerEl) {
      this.endlessBannerEl.style.display = isEndless ? 'flex' : 'none';
    }
    if (this.levelBannerEl) {
      this.levelBannerEl.style.display = isEndless ? 'none' : 'block';
    }
  }

  /**
   * Throttled 10 Hz DOM update for Endless Run live stats.
   */
  public updateEndless(
    timeSec: number,
    score: number,
    bestScore: number,
    cannonCount: number
  ): void {
    const now = performance.now();
    if (now - this.lastEndlessUpdateMs < 100) {
      return; // 10 Hz throttle
    }
    this.lastEndlessUpdateMs = now;

    if (this.hudEndlessTime) {
      const m = Math.floor(timeSec / 60);
      const s = Math.floor(timeSec % 60);
      this.hudEndlessTime.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    if (this.hudEndlessScore) {
      this.hudEndlessScore.textContent = `${score.toLocaleString()} PTS`;
    }
    if (this.hudEndlessBest) {
      this.hudEndlessBest.textContent = `BEST: ${bestScore.toLocaleString()}`;
    }
    if (this.hudCannonCount) {
      this.hudCannonCount.textContent = `CANNON x${cannonCount}`;
    }
  }

  public setLevel(level: LevelData): void {
    this.currentLevelId = level.id;
    if (this.levelBadgeEl) {
      this.levelBadgeEl.textContent = `LVL ${level.id}`;
    }
    if (this.levelTitleEl) {
      this.levelTitleEl.textContent = level.name.toUpperCase();
    }
    if (this.nextLevelBtn) {
      // Hide next level button on final level
      this.nextLevelBtn.style.display = level.id >= 5 ? 'none' : 'inline-flex';
    }
  }

  public update(
    baseHp: number,
    maxHp: number,
    isGameOver: boolean,
    isGameWon: boolean = false,
    towersRemaining: number = 0,
    bossesRemaining: number = 0
  ): void {
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

    // 3. Level Objectives tracking
    if (this.objTowersEl) {
      if (towersRemaining === 0) {
        this.objTowersEl.textContent = 'TOWER: ✓';
        this.objTowersEl.classList.add('cleared');
      } else {
        this.objTowersEl.textContent = `TOWER: ${towersRemaining}`;
        this.objTowersEl.classList.remove('cleared');
      }
    }

    if (this.objBossEl) {
      if (bossesRemaining === 0) {
        this.objBossEl.textContent = 'BOSS: ✓';
        this.objBossEl.classList.add('cleared');
      } else {
        this.objBossEl.textContent = `BOSS: ${bossesRemaining}`;
        this.objBossEl.classList.remove('cleared');
      }
    }

    // 4. Modal presentation: Victory or Game Over
    if (isGameWon) {
      this.hideGameOver();
      this.showVictory(baseHp, maxHp);
    } else if (isGameOver) {
      this.hideVictory();
      this.showGameOver();
    } else {
      this.hideGameOver();
      this.hideVictory();
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

  public showEndlessGameOver(
    score: number,
    survivalSeconds: number,
    bestScore: number,
    isNewBest: boolean
  ): void {
    const timeEl = document.getElementById('go-time');
    const scoreEl = document.getElementById('go-score');
    const bestEl = document.getElementById('go-best');
    const formatTime = (totalSec: number) => {
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    if (timeEl) timeEl.textContent = formatTime(survivalSeconds);
    if (scoreEl) scoreEl.textContent = `${score.toLocaleString()}${isNewBest ? ' 🔥 NEW BEST!' : ''}`;
    if (bestEl) bestEl.textContent = `${bestScore.toLocaleString()} PTS`;
    this.showGameOver();
  }

  public hideGameOver(): void {
    if (this.gameOverModal && this.gameOverModal.style.display !== 'none') {
      this.gameOverModal.style.display = 'none';
    }
  }

  public showVictory(baseHp: number, maxHp: number): void {
    const pct = (baseHp / maxHp) * 100;
    const stars = pct >= 80 ? '⭐⭐⭐' : pct >= 40 ? '⭐⭐' : '⭐';

    if (this.victoryStarsEl) {
      this.victoryStarsEl.textContent = stars;
    }
    if (this.victoryBaseStatus) {
      this.victoryBaseStatus.textContent = `${Math.round(baseHp)} / ${maxHp} HP (${Math.round(pct)}%)`;
    }
    if (this.victoryModal && this.victoryModal.style.display !== 'flex') {
      this.victoryModal.style.display = 'flex';
    }
  }

  public hideVictory(): void {
    if (this.victoryModal && this.victoryModal.style.display !== 'none') {
      this.victoryModal.style.display = 'none';
    }
  }

  public reset(maxHp: number = CONFIG.BASE_MAX_HP): void {
    this.lastHp = maxHp;
    this.hideGameOver();
    this.hideVictory();
    if (this.damageVignette) {
      this.damageVignette.style.opacity = '0';
    }
    if (this.baseHpText && this.baseHpFill) {
      this.baseHpText.textContent = `${maxHp} / ${maxHp}`;
      this.baseHpFill.style.width = '100%';
      this.baseHpFill.classList.remove('danger');
    }
    if (this.objTowersEl) {
      this.objTowersEl.textContent = 'TOWER: 1';
      this.objTowersEl.classList.remove('cleared');
    }
    if (this.objBossEl) {
      this.objBossEl.textContent = 'BOSS: 1';
      this.objBossEl.classList.remove('cleared');
    }
  }
}
