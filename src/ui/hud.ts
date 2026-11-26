import { CONFIG } from '../config/constants';
import { LevelData } from '../data/level';

export interface HudCallbacks {
  onRestart: () => void;
  onNextLevel: () => void;
  onOpenMenu: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onToggleSound?: () => boolean;
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
  private hudCannonTier: HTMLElement | null = null;
  private hudOverdrive: HTMLElement | null = null;
  private hudBossStatus: HTMLElement | null = null;
  private panelMaxPopup: HTMLElement | null = null;
  private pauseModal: HTMLElement | null = null;
  private btnResume: HTMLElement | null = null;
  private btnPauseRestart: HTMLElement | null = null;
  private btnPauseSound: HTMLElement | null = null;
  private btnPauseMainMenu: HTMLElement | null = null;
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
    this.hudCannonTier = document.getElementById('hud-cannon-tier');
    this.hudOverdrive = document.getElementById('hud-overdrive');
    this.hudBossStatus = document.getElementById('hud-boss-status');
    this.panelMaxPopup = document.getElementById('panel-max-popup');
    this.pauseModal = document.getElementById('pause-modal');
    this.btnResume = document.getElementById('btn-resume');
    this.btnPauseRestart = document.getElementById('btn-pause-restart');
    this.btnPauseSound = document.getElementById('btn-pause-sound');
    this.btnPauseMainMenu = document.getElementById('btn-pause-mainmenu');

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
        if (this.callbacks.onPause) {
          this.callbacks.onPause();
        } else {
          this.callbacks.onOpenMenu();
        }
      });
    }

    if (this.btnResume) {
      this.btnResume.addEventListener('click', () => {
        this.hidePause();
        this.callbacks.onResume?.();
      });
    }

    if (this.btnPauseRestart) {
      this.btnPauseRestart.addEventListener('click', () => {
        this.hidePause();
        this.callbacks.onRestart();
      });
    }

    if (this.btnPauseSound) {
      this.btnPauseSound.addEventListener('click', () => {
        if (this.callbacks.onToggleSound) {
          const isMuted = this.callbacks.onToggleSound();
          this.updatePauseSoundButton(isMuted);
        }
      });
    }

    if (this.btnPauseMainMenu) {
      this.btnPauseMainMenu.addEventListener('click', () => {
        this.hidePause();
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
    cannonCount: number,
    tier: number = 0,
    overdriveSec: number = 0,
    bossCountdownSec: number = 60,
    activeBossHp: number = 0,
    activeBossMaxHp: number = 0,
    activeBossId: number = 0
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
    if (this.hudCannonTier) {
      this.hudCannonTier.textContent = `TIER ${tier} / ${CONFIG.MAX_TIER}`;
    }
    if (this.hudOverdrive) {
      if (overdriveSec > 0) {
        this.hudOverdrive.style.display = 'inline-block';
        this.hudOverdrive.textContent = `OVERDRIVE ${overdriveSec.toFixed(1)}s`;
      } else {
        this.hudOverdrive.style.display = 'none';
      }
    }
    if (this.hudBossStatus) {
      if (activeBossHp > 0 && activeBossMaxHp > 0) {
        this.hudBossStatus.classList.add('active');
        this.hudBossStatus.textContent = `BOSS #${activeBossId}: ${Math.ceil(activeBossHp)}/${activeBossMaxHp} HP`;
      } else {
        this.hudBossStatus.classList.remove('active');
        this.hudBossStatus.textContent = `BOSS IN ${Math.ceil(bossCountdownSec)}s`;
      }
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

  public showMaxPanelPopup(screenX: number, screenY: number, amount: number): void {
    const el = this.panelMaxPopup;
    if (!el) return;
    const containerWidth = el.parentElement?.clientWidth || 390;
    const clampedX = Math.max(76, Math.min(containerWidth - 76, screenX));
    el.textContent = `MAX! +${amount}`;
    el.style.left = `${Math.round(clampedX)}px`;
    el.style.top = `${Math.round(screenY)}px`;
    el.classList.remove('show');
    // Trigger reflow to restart CSS keyframe animation cleanly
    void el.offsetWidth;
    el.classList.add('show');
  }

  public showPause(timeSec: number, score: number, cannonCount: number, tier: number, isMuted: boolean): void {
    const timeEl = document.getElementById('pause-time');
    const scoreEl = document.getElementById('pause-score');
    const cannonEl = document.getElementById('pause-cannon');
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    if (timeEl) timeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (scoreEl) scoreEl.textContent = `${score.toLocaleString()} PTS`;
    if (cannonEl) cannonEl.textContent = `x${cannonCount} (TIER ${tier}/${CONFIG.MAX_TIER})`;
    this.updatePauseSoundButton(isMuted);
    if (this.pauseModal) {
      this.pauseModal.style.display = 'flex';
    }
  }

  public hidePause(): void {
    if (this.pauseModal && this.pauseModal.style.display !== 'none') {
      this.pauseModal.style.display = 'none';
    }
  }

  public updatePauseSoundButton(isMuted: boolean): void {
    if (this.btnPauseSound) {
      this.btnPauseSound.textContent = isMuted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
    }
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
    bestTimeSec: number,
    kills: number,
    bossesDefeated: number,
    isNewBest: boolean
  ): void {
    const timeEl = document.getElementById('go-time');
    const bestTimeEl = document.getElementById('go-best-time');
    const scoreEl = document.getElementById('go-score');
    const bestEl = document.getElementById('go-best');
    const killsEl = document.getElementById('go-kills');
    const bossesEl = document.getElementById('go-bosses');
    const formatTime = (totalSec: number) => {
      const m = Math.floor(totalSec / 60);
      const s = Math.floor(totalSec % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    if (timeEl) timeEl.textContent = formatTime(survivalSeconds);
    if (bestTimeEl) bestTimeEl.textContent = formatTime(bestTimeSec);
    if (scoreEl) scoreEl.textContent = `${score.toLocaleString()}${isNewBest ? ' 🔥 NEW BEST!' : ''}`;
    if (bestEl) bestEl.textContent = `${bestScore.toLocaleString()} PTS`;
    if (killsEl) killsEl.textContent = kills.toLocaleString();
    if (bossesEl) bossesEl.textContent = bossesDefeated.toLocaleString();
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
