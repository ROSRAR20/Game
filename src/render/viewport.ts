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
        console.info(`[SwarmGate] DPR overridden via query param: ${parsed}`);
      }
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getSize(): ViewportSize {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    let dpr: number;
    if (this.dprOverride !== null) {
      dpr = this.dprOverride;
    } else {
      const rawDpr = window.devicePixelRatio || 1;
      dpr = Math.min(rawDpr, CONFIG.MAX_DPR);
    }

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
