import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  projectDragDelta,
  ndcToPixel,
  computeWorldXPixelVector
} from '../../src/input/drag_projection';

describe('Drag Projection Math (projectDragDelta)', () => {
  it('returns +1.0 when finger moves along the projected axis by its exact length', () => {
    // Projected axis at an angle, length = 50px (e.g. 40px right, 30px down)
    const axis = { x: 40, y: 30 };
    const fingerDelta = { x: 40, y: 30 };

    const result = projectDragDelta(fingerDelta, axis);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 when finger moves perpendicular to the projected axis', () => {
    // Axis vector (40, 30), perpendicular vector (-30, 40)
    const axis = { x: 40, y: 30 };
    const fingerDelta = { x: -30, y: 40 };

    const result = projectDragDelta(fingerDelta, axis);
    expect(result).toBeCloseTo(0.0, 5);
  });

  it('returns -1.0 when finger moves directly opposite to the projected axis', () => {
    const axis = { x: 40, y: 30 };
    const fingerDelta = { x: -40, y: -30 };

    const result = projectDragDelta(fingerDelta, axis);
    expect(result).toBeCloseTo(-1.0, 5);
  });

  it('reproduces standard horizontal drag when yaw is 0 (y = 0)', () => {
    // Axis purely horizontal: 1 world unit = 35 screen pixels
    const axis = { x: 35, y: 0 };
    const fingerDelta = { x: 70, y: 15 }; // 70px horizontal, 15px vertical jitter

    const result = projectDragDelta(fingerDelta, axis);
    // Vertical jitter ignored, horizontal move 70 / 35 = +2.0 world units
    expect(result).toBeCloseTo(2.0, 5);
  });

  it('returns 0 for degenerate or zero-length axis vector', () => {
    const axis = { x: 0, y: 0 };
    const fingerDelta = { x: 50, y: 50 };

    expect(projectDragDelta(fingerDelta, axis)).toBe(0);
  });
});

describe('NDC to Pixel Conversion (ndcToPixel)', () => {
  it('correctly flips Y when converting NDC to screen pixels', () => {
    const width = 390;
    const height = 844;

    // Top-left: NDC (-1, 1) -> Pixel (0, 0)
    const topLeft = ndcToPixel(-1, 1, width, height);
    expect(topLeft.x).toBeCloseTo(0, 2);
    expect(topLeft.y).toBeCloseTo(0, 2);

    // Center: NDC (0, 0) -> Pixel (195, 422)
    const center = ndcToPixel(0, 0, width, height);
    expect(center.x).toBeCloseTo(195, 2);
    expect(center.y).toBeCloseTo(422, 2);

    // Bottom-right: NDC (1, -1) -> Pixel (390, 844)
    const bottomRight = ndcToPixel(1, -1, width, height);
    expect(bottomRight.x).toBeCloseTo(390, 2);
    expect(bottomRight.y).toBeCloseTo(844, 2);
  });
});

describe('World-X Pixel Vector Derivation (computeWorldXPixelVector)', () => {
  it('derives on-screen pixel vector for camera looking along +Z (world +X projects to screen left)', () => {
    const camera = new THREE.PerspectiveCamera(50, 390 / 844, 0.1, 200);
    camera.position.set(0, 15, -10);
    camera.lookAt(0, 0, 20);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const ref = { x: 0, y: 0, z: 5 };
    const vec = computeWorldXPixelVector(camera, ref, 390, 844);

    // In Three.js looking down +Z, world +X projects to the screen left (vec.x < 0)
    expect(vec.x).toBeLessThan(0);
    expect(vec.y).toBeCloseTo(0, 1);

    // Finger moving along vec gives exactly +1.0 world X
    expect(projectDragDelta(vec, vec)).toBeCloseTo(1.0, 5);

    // Finger moving opposite gives -1.0 world X
    expect(projectDragDelta({ x: -vec.x, y: -vec.y }, vec)).toBeCloseTo(-1.0, 5);

    // Finger moving perpendicular gives 0.0 world X
    expect(projectDragDelta({ x: -vec.y, y: vec.x }, vec)).toBeCloseTo(0.0, 5);
  });

  it('reflects camera yaw in non-zero screen Y delta for world-X', () => {
    const camera = new THREE.PerspectiveCamera(50, 390 / 844, 0.1, 200);
    // Rotate camera with yaw
    camera.position.set(-5, 15, -10);
    camera.lookAt(5, 0, 25);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const ref = { x: 0, y: 0, z: 5 };
    const vec = computeWorldXPixelVector(camera, ref, 390, 844);

    // With horizontal yaw and downward pitch, world +X tilts on screen
    expect(vec.x).not.toBe(0);
    expect(vec.y).not.toBe(0);
  });
});
