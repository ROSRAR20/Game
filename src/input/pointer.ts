import * as THREE from 'three';
import { CONFIG } from '../config/constants';
import { CannonSim } from '../sim/cannon';
import {
  Vector2D,
  projectDragDelta,
  computeWorldXPixelVector
} from './drag_projection';

export class InputManager {
  private cannon: CannonSim;
  private container: HTMLElement;
  private camera: THREE.Camera;
  private worldXPixelVector: Vector2D = { x: -35, y: 0 };

  private isDragging: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private activePointerId: number | null = null;

  // Keyboard keys active
  private keyLeft: boolean = false;
  private keyRight: boolean = false;

  constructor(
    container: HTMLElement,
    cannon: CannonSim,
    camera: THREE.Camera
  ) {
    this.container = container;
    this.cannon = cannon;
    this.camera = camera;

    this.updateProjectionAxis();
    this.attachPointerListeners();
    this.attachKeyboardListeners();
  }

  /**
   * Recomputes the on-screen pixel vector of one world-X unit at the cannon's world position.
   * Called on initial setup, on viewport resize, and whenever camera tuning parameters change.
   */
  public updateProjectionAxis(cam: THREE.Camera = this.camera): void {
    this.camera = cam;
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    this.worldXPixelVector = computeWorldXPixelVector(
      this.camera,
      { x: 0, y: 0, z: CONFIG.CANNON_Z },
      width,
      height
    );
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

    // Do not initiate cannon drag if interacting with UI overlays (debug overlay, camera tuner, modals)
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.closest('#debug-overlay') ||
        target.closest('#cam-tuner-panel') ||
        target.closest('#cam-qs-modal') ||
        target.closest('#game-over-modal') ||
        target.closest('#victory-modal'))
    ) {
      return;
    }

    this.activePointerId = e.pointerId;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    try {
      this.container.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture is unsupported or failed
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    const deltaPixel: Vector2D = {
      x: e.clientX - this.lastPointerX,
      y: e.clientY - this.lastPointerY
    };
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // Pure function projection: finger delta projected onto camera-derived world-X axis.
    // Cannon follows the thumb along the diagonal on screen.
    const deltaWorldX = projectDragDelta(deltaPixel, this.worldXPixelVector);
    this.cannon.addDeltaX(deltaWorldX);
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
