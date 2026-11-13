import * as THREE from 'three';

export interface DebugMetrics {
  fps: number;
  frameTimeMs: number;
  unitCount: number;
  visibleCount: number;
  drawCalls: number;
  triangles: number;
  dpr: number;
}

export class DebugOverlay {
  private isVisible: boolean = false;
  private stressCount: number = 0;

  private overlayEl: HTMLElement | null = null;
  private fpsEl: HTMLElement | null = null;
  private msEl: HTMLElement | null = null;
  private unitsEl: HTMLElement | null = null;
  private drawsEl: HTMLElement | null = null;
  private trisEl: HTMLElement | null = null;
  private dprEl: HTMLElement | null = null;

  // Frame timing
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private fps: number = 60;
  private frameTimeMs: number = 16.6;

  constructor() {
    this.parseQueryParams();
    this.initDOM();
  }

  private parseQueryParams(): void {
    const params = new URLSearchParams(window.location.search);
    const hasStoredDebug =
      typeof localStorage !== 'undefined' && localStorage.getItem('swarmgate_debug') === 'true';

    if (params.has('debug') || hasStoredDebug) {
      this.isVisible = true;
    }

    if (params.has('stress')) {
      const val = parseInt(params.get('stress') || '0', 10);
      if (!isNaN(val) && val > 0) {
        this.stressCount = val;
        // Automatically enable debug overlay in stress mode
        this.isVisible = true;
      }
    }
  }

  private initDOM(): void {
    this.overlayEl = document.getElementById('debug-overlay');
    this.fpsEl = document.getElementById('dbg-fps');
    this.msEl = document.getElementById('dbg-ms');
    this.unitsEl = document.getElementById('dbg-units');
    this.drawsEl = document.getElementById('dbg-draws');
    this.trisEl = document.getElementById('dbg-tris');
    this.dprEl = document.getElementById('dbg-dpr');

    if (this.overlayEl && this.isVisible) {
      this.overlayEl.style.display = 'block';
    }

    // Triple tap in the top-left area to toggle debug overlay on device
    let tapCount = 0;
    let lastTapTime = 0;
    window.addEventListener('pointerdown', (e) => {
      if (e.clientY < 120 && e.clientX < 150) {
        const now = performance.now();
        if (now - lastTapTime < 500) {
          tapCount++;
          if (tapCount >= 3) {
            this.toggleVisibility();
            tapCount = 0;
          }
        } else {
          tapCount = 1;
        }
        lastTapTime = now;
      }
    });

    // Dev/debug hook
    (window as unknown as { __toggleDebug?: () => void }).__toggleDebug = () =>
      this.toggleVisibility();
  }

  public toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('swarmgate_debug', this.isVisible ? 'true' : 'false');
    }
    if (this.overlayEl) {
      this.overlayEl.style.display = this.isVisible ? 'block' : 'none';
    }
  }

  public getStressCount(): number {
    return this.stressCount;
  }

  public isDebugActive(): boolean {
    return this.isVisible;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.overlayEl) {
      this.overlayEl.style.display = visible ? 'block' : 'none';
    }
  }

  public update(
    now: number,
    activeUnits: number,
    getVisibleUnits: () => number,
    renderer: THREE.WebGLRenderer,
    dpr: number
  ): void {
    const delta = now - this.lastTime;
    this.frameCount++;

    if (delta >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameTimeMs = Number((delta / this.frameCount).toFixed(1));
      this.frameCount = 0;
      this.lastTime = now;

      if (this.isVisible && this.overlayEl) {
        const visibleUnits = getVisibleUnits();
        if (this.fpsEl) this.fpsEl.textContent = String(this.fps);
        if (this.msEl) this.msEl.textContent = String(this.frameTimeMs);
        if (this.unitsEl) {
          this.unitsEl.textContent = `${activeUnits} (vis: ${visibleUnits})`;
        }
        if (this.drawsEl) this.drawsEl.textContent = String(renderer.info.render.calls);
        if (this.trisEl) this.trisEl.textContent = String(renderer.info.render.triangles);
        if (this.dprEl) this.dprEl.textContent = String(dpr.toFixed(1));
      }
    }
  }

  public getMetrics(): DebugMetrics {
    return {
      fps: this.fps,
      frameTimeMs: this.frameTimeMs,
      unitCount: 0,
      visibleCount: 0,
      drawCalls: 0,
      triangles: 0,
      dpr: 1.0
    };
  }
}
