import { SaveData } from '../platform/storage';
import { getLevelData, TOTAL_LEVELS } from '../data/level';

export interface MenuCallbacks {
  onStartLevel: (levelId: number) => void;
  onToggleSound: () => boolean; // returns new muted state
  onOpenLevelSelect?: () => void;
}

export class MenuController {
  private mainMenuEl: HTMLElement | null = null;
  private levelSelectModalEl: HTMLElement | null = null;
  private btnPlay: HTMLElement | null = null;
  private btnLevelSelect: HTMLElement | null = null;
  private btnSoundToggle: HTMLElement | null = null;
  private btnCloseLevelSelect: HTMLElement | null = null;
  private levelGridEl: HTMLElement | null = null;
  private menuSelectedLevelEl: HTMLElement | null = null;

  private isMenuVisible = true;
  private currentSelectedLevel = 1;
  private readonly callbacks: MenuCallbacks;

  constructor(callbacks: MenuCallbacks) {
    this.callbacks = callbacks;
    this.initDOM();
  }

  private initDOM(): void {
    if (typeof document === 'undefined') return;

    this.mainMenuEl = document.getElementById('main-menu');
    this.levelSelectModalEl = document.getElementById('level-select-modal');
    this.btnPlay = document.getElementById('btn-play');
    this.btnLevelSelect = document.getElementById('btn-level-select');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.btnCloseLevelSelect = document.getElementById('btn-close-level-select');
    this.levelGridEl = document.getElementById('level-grid');
    this.menuSelectedLevelEl = document.getElementById('menu-selected-level');

    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', () => {
        this.hideMainMenu();
        this.callbacks.onStartLevel(this.currentSelectedLevel);
      });
    }

    if (this.btnLevelSelect) {
      this.btnLevelSelect.addEventListener('click', () => {
        this.showLevelSelect();
      });
    }

    if (this.btnCloseLevelSelect) {
      this.btnCloseLevelSelect.addEventListener('click', () => {
        this.hideLevelSelect();
      });
    }

    if (this.btnSoundToggle) {
      this.btnSoundToggle.addEventListener('click', () => {
        const isMuted = this.callbacks.onToggleSound();
        this.updateSoundButton(isMuted);
      });
    }
  }

  public showMainMenu(saveData: SaveData, levelId?: number): void {
    if (levelId !== undefined) {
      this.currentSelectedLevel = levelId;
    }

    if (this.menuSelectedLevelEl) {
      const formatTime = (totalSec: number) => {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };
      this.menuSelectedLevelEl.textContent = `BEST: ${saveData.bestScore.toLocaleString()} PTS · ${formatTime(saveData.bestTimeSec)} · ${saveData.totalKills.toLocaleString()} KILLS`;
    }

    if (this.btnPlay) {
      this.btnPlay.textContent = 'PLAY';
    }

    // Level select is hidden in Endless Run mode
    if (this.btnLevelSelect) {
      this.btnLevelSelect.style.display = 'none';
    }

    this.updateSoundButton(!saveData.soundEnabled);
    this.renderLevelGrid(saveData);

    if (this.mainMenuEl) {
      this.mainMenuEl.style.display = 'flex';
      this.isMenuVisible = true;
    }
  }

  public hideMainMenu(): void {
    if (this.mainMenuEl) {
      this.mainMenuEl.style.display = 'none';
      this.isMenuVisible = false;
    }
  }

  public showLevelSelect(): void {
    if (this.levelSelectModalEl) {
      this.levelSelectModalEl.style.display = 'flex';
    }
  }

  public hideLevelSelect(): void {
    if (this.levelSelectModalEl) {
      this.levelSelectModalEl.style.display = 'none';
    }
  }

  public updateSoundButton(muted: boolean): void {
    if (this.btnSoundToggle) {
      this.btnSoundToggle.textContent = muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
      this.btnSoundToggle.classList.toggle('muted', muted);
    }
  }

  public renderLevelGrid(saveData: SaveData): void {
    if (!this.levelGridEl) return;
    this.levelGridEl.innerHTML = '';

    const highest = saveData.highestUnlockedLevel;

    for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
      const isUnlocked = lvl <= highest;
      const levelData = getLevelData(lvl);
      const stars = saveData.levelStars[lvl] || 0;

      const card = document.createElement('div');
      card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'} ${lvl === this.currentSelectedLevel ? 'selected' : ''}`;
      card.setAttribute('data-level', String(lvl));

      let starDisplay = '';
      if (isUnlocked) {
        starDisplay = stars > 0 ? '⭐'.repeat(stars) : 'NEW';
      } else {
        starDisplay = '🔒 LOCKED';
      }

      card.innerHTML = `
        <div class="lvl-num">${lvl}</div>
        <div class="lvl-info">
          <div class="lvl-name">${levelData.name}</div>
          <div class="lvl-badge">${starDisplay}</div>
        </div>
      `;

      if (isUnlocked) {
        card.addEventListener('click', () => {
          this.currentSelectedLevel = lvl;
          this.hideLevelSelect();
          this.hideMainMenu();
          this.callbacks.onStartLevel(lvl);
        });
      }

      this.levelGridEl.appendChild(card);
    }
  }

  public getIsMenuVisible(): boolean {
    return this.isMenuVisible;
  }
}
