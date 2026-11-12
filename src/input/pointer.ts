import { CONFIG } from '../config/constants';
import { CannonSim } from '../sim/cannon';

export class InputManager {
  private cannon: CannonSim;
  private container: HTMLElement;

  private isDragging: boolean = false;
  private lastPointerX: number = 0;
  private activePointerId: number | null = null;

  // Keyboard keys active
  private keyLeft: boolean = false;
  private keyRight: boolean = false;

  constructor(container: HTMLElement, cannon: CannonSim) {
    this.container = container;
    this.cannon = cannon;

    this.attachPointerListeners();
    this.attachKeyboardListeners();
  }

  private attachPointerListeners(): void {
    this.container.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  private attachKeyboardListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    // Single finger touch tracking
    if (this.activePointerId !== null) return;

    this.activePointerId = e.pointerId;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.container.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    const deltaPixelX = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;

    // Convert pixel delta to world units based on road width
    const rect = this.container.getBoundingClientRect();
    const containerWidth = Math.max(1, rect.width);
    // Relative touch sensitivity factor (1.5x gives responsive feel on mobile)
    const worldDeltaX = (deltaPixelX / containerWidth) * CONFIG.ROAD_WIDTH * 1.5;

    this.cannon.addDeltaX(worldDeltaX);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.activePointerId) {
      this.isDragging = false;
      this.activePointerId = null;
      try {
        this.container.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture already lost
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      this.keyLeft = true;
    } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      this.keyRight = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      this.keyLeft = false;
    } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      this.keyRight = false;
    }
  };

  public update(dt: number): void {
    // Keyboard input fallback for desktop verification
    if (this.keyLeft) {
      const keyboardSpeed = 16; // world units per sec
      this.cannon.addDeltaX(-keyboardSpeed * dt);
    }
    if (this.keyRight) {
      const keyboardSpeed = 16;
      this.cannon.addDeltaX(keyboardSpeed * dt);
    }
  }

  public dispose(): void {
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
