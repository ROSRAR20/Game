import { PlatformLifecycle } from '../platform/lifecycle';

/**
 * Procedural WebAudio sound synthesizer.
 * Creates rich, arcade-style sound effects completely in code with 0 asset downloads.
 * Unlocks on first user interaction and cleanly suspends/resumes on mobile lifecycle events.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isUnlocked = false;
  private isMuted = false;

  private lastShootTime = 0;
  private lastHitTime = 0;

  constructor() {
    this.setupUnlockListeners();
    this.setupLifecycleListeners();
  }

  private setupUnlockListeners(): void {
    const unlock = () => {
      this.initContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  private setupLifecycleListeners(): void {
    PlatformLifecycle.addListener({
      onPause: () => {
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      },
      onResume: () => {
        if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
          this.ctx.resume().catch(() => {});
        }
      }
    });
  }

  public initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        return;
      }

      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.isUnlocked = true;
    } catch (e) {
      console.warn('[SoundManager] AudioContext initialization deferred:', e);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : 0.35,
        this.ctx.currentTime
      );
    }
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  /**
   * Cannon firing sound: Crisp, punchy downward chirp.
   */
  public playShoot(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const now = performance.now();
    if (now - this.lastShootTime < 70) return; // rate throttle
    this.lastShootTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * Mobs passing through multiplier gate: Bright, shimmering harmonic chime.
   */
  public playGatePass(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.03);

      gain.gain.setValueAtTime(0.0, t);
      gain.gain.setValueAtTime(0.18, t + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.03 + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + idx * 0.03);
      osc.stop(t + idx * 0.03 + 0.23);
    });
  }

  /**
   * Mob combat collision / damage hit: Fast percussive click.
   */
  public playHit(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const now = performance.now();
    if (now - this.lastHitTime < 50) return; // rate limit hit sounds
    this.lastHitTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * "LV+1" Cannon upgrade collection: Triumphant rising arpeggio.
   */
  public playLevelUp(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0.0, t);
      gain.gain.setValueAtTime(0.25, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.22);
    });
  }

  /**
   * Tower / Boss destruction explosion: Deep sub rumble and explosive impact.
   */
  public playTowerExplosion(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    // Sub-bass sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.45);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  /**
   * Level Victory fanfare.
   */
  public playVictory(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const t = this.ctx.currentTime;
    const fanfare = [
      { f: 523.25, d: 0.12, wait: 0 },
      { f: 659.25, d: 0.12, wait: 0.13 },
      { f: 783.99, d: 0.14, wait: 0.26 },
      { f: 1046.5, d: 0.4, wait: 0.42 }
    ];

    fanfare.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t + n.wait);

      gain.gain.setValueAtTime(0.35, t + n.wait);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.wait + n.d);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + n.wait);
      osc.stop(t + n.wait + n.d + 0.02);
    });
  }

  /**
   * Game Over sad sound.
   */
  public playGameOver(): void {
    if (!this.ctx || this.isMuted || !this.isUnlocked) return;
    const t = this.ctx.currentTime;
    const defeat = [
      { f: 392.0, d: 0.2, wait: 0 },
      { f: 369.99, d: 0.2, wait: 0.22 },
      { f: 329.63, d: 0.45, wait: 0.44 }
    ];

    defeat.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, t + n.wait);

      gain.gain.setValueAtTime(0.3, t + n.wait);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.wait + n.d);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + n.wait);
      osc.stop(t + n.wait + n.d + 0.02);
    });
  }
}
