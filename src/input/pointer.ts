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
    // Listen on window so touches/clicks anywhere on screen drag the cannon smoothly
    window.addEventListener('pointerdown', this.onPointerDown);
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

    // Do not initiate cannon drag if interacting with the debug overlay
    const target = e.target as HTMLElement | null;
    if (target && target.closest('#debug-overlay')) return;

    this.activePointerId = e.pointerId;
    this.isDragging = true;
    this.lastPointerX = e.clientX;

    try {
      this.container.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture is unsupported or failed
    }
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

    // In Three.js right-handed camera looking along +Z:
    // Screen Right corresponds to decreasing X in world space.
    // Therefore, dragging right (deltaPixelX > 0) decreases world X to move right on screen.
    this.cannon.addDeltaX(-worldDeltaX);
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
    // Keyboard input fallback:
    // Left on screen -> increase world X
    // Right on screen -> decrease world X
    const keyboardSpeed = 16; // world units per sec
    if (this.keyLeft) {
      this.cannon.addDeltaX(keyboardSpeed * dt);
    }
    if (this.keyRight) {
      this.cannon.addDeltaX(-keyboardSpeed * dt);
    }
  }

  public dispose(): void {
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
