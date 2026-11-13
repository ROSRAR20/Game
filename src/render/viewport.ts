import { CONFIG } from '../config/constants';

export interface ViewportSize {
  width: number;
  height: number;
  dpr: number;
  aspect: number;
}

export class ViewportManager {
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private onResizeCallback?: (size: ViewportSize) => void;
  private dprOverride: number | null = null;
  private dynamicDpr: number = CONFIG.DEFAULT_DPR;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;

    this.parseDprOverride();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
  }

  private parseDprOverride(): void {
    const params = new URLSearchParams(window.location.search);
    const dprParam = params.get('dpr');
    if (dprParam !== null) {
      const parsed = parseFloat(dprParam);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 3) {
        this.dprOverride = parsed;
        this.dynamicDpr = parsed;
        console.info(`[SwarmGate] Manual DPR override active: ${parsed}`);
      }
    }
  }

  public hasManualDprOverride(): boolean {
    return this.dprOverride !== null;
  }

  public setDynamicDpr(newDpr: number): void {
    if (this.dprOverride !== null) return; // Respect manual override
    if (Math.abs(this.dynamicDpr - newDpr) > 0.05) {
      this.dynamicDpr = Math.max(0.75, Math.min(newDpr, 1.5));
      this.handleResize();
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getSize(): ViewportSize {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    const dpr = this.dprOverride !== null ? this.dprOverride : this.dynamicDpr;
    const aspect = width / height;

    return { width, height, dpr, aspect };
  }

  public onResize(callback: (size: ViewportSize) => void): void {
    this.onResizeCallback = callback;
  }

  private handleResize = (): void => {
    if (this.onResizeCallback) {
      this.onResizeCallback(this.getSize());
    }
  };

  public dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
  }
}
