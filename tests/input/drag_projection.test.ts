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

    // In Three.js looking down +Z, world +X projects to screen left (vec.x < 0)
    expect(vec.x).toBeLessThan(0);
    expect(vec.y).toBeCloseTo(0, 1);

    // Moving along vec by its length gives +1.0
    expect(projectDragDelta(vec, vec)).toBeCloseTo(1.0, 5);

    // Moving opposite gives -1.0
    expect(projectDragDelta({ x: -vec.x, y: -vec.y }, vec)).toBeCloseTo(-1.0, 5);

    // Moving perpendicular gives 0.0
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

  it('verifies that drag projection follows the thumb across camera Presets A, B, and C', () => {
    const presets = [
      { name: 'Preset A (Close)', pos: [-4.8, 21, -4.0], pitch: 52, yaw: 15, fov: 50 },
      { name: 'Preset B (Medium)', pos: [-8.0, 28, -3.5], pitch: 55, yaw: 25, fov: 52 },
      { name: 'Preset C (Far / Wide)', pos: [-11.0, 38, -3.0], pitch: 56, yaw: 35, fov: 54 }
    ];

    for (const p of presets) {
      const camera = new THREE.PerspectiveCamera(p.fov, 390 / 844, 0.1, 500);
      camera.position.set(p.pos[0]!, p.pos[1]!, p.pos[2]!);
      const pitchRad = (p.pitch * Math.PI) / 180;
      const yawRad = (p.yaw * Math.PI) / 180;
      const dir = new THREE.Vector3(
        Math.sin(yawRad) * Math.cos(pitchRad),
        -Math.sin(pitchRad),
        Math.cos(yawRad) * Math.cos(pitchRad)
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(camera.position.clone().add(dir.clone().multiplyScalar(50)));
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const u = computeWorldXPixelVector(camera, { x: 0, y: 0, z: 5 }, 390, 844);

      // Drag along diagonal axis u by its length yields exactly +1.0 world units
      expect(projectDragDelta(u, u)).toBeCloseTo(1.0, 5);

      // Drag opposite to u yields -1.0 world units
      expect(projectDragDelta({ x: -u.x, y: -u.y }, u)).toBeCloseTo(-1.0, 5);

      // Drag perpendicular yields 0.0
      expect(projectDragDelta({ x: -u.y, y: u.x }, u)).toBeCloseTo(0.0, 5);
    }
  });
});

