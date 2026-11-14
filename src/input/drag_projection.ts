import * as THREE from 'three';

export interface Vector2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Pure function: projects finger delta in screen pixels onto the on-screen pixel vector
 * representing 1 world-X unit.
 *
 * Properties:
 * - A finger move along the projected axis by the pixel length of 1 world unit yields +1.0.
 * - A finger move perpendicular to the projected axis yields 0.0.
 * - An opposite finger move yields -1.0.
 * - When yaw is 0 (world-X on-screen vector is strictly horizontal with y = 0),
 *   this yields fingerDeltaPx.x / worldXUnitVectorPx.x, reproducing standard horizontal drag.
 */
export function projectDragDelta(
  fingerDeltaPx: Vector2D,
  worldXUnitVectorPx: Vector2D
): number {
  const lenSq =
    worldXUnitVectorPx.x * worldXUnitVectorPx.x +
    worldXUnitVectorPx.y * worldXUnitVectorPx.y;

  if (lenSq < 1e-6) {
    return 0;
  }

  // (fingerDelta · u) / |u|^2
  return (
    (fingerDeltaPx.x * worldXUnitVectorPx.x +
      fingerDeltaPx.y * worldXUnitVectorPx.y) /
    lenSq
  );
}

/**
 * Converts a 3D point in Normalized Device Coordinates (NDC, [-1, 1]) to screen pixel coordinates,
 * flipping the Y axis (NDC Y is +1 at top, screen Y is 0 at top).
 */
export function ndcToPixel(
  ndcX: number,
  ndcY: number,
  viewportWidth: number,
  viewportHeight: number
): Vector2D {
  return {
    x: ((ndcX + 1) / 2) * viewportWidth,
    y: ((1 - ndcY) / 2) * viewportHeight
  };
}

/**
 * Computes the 2D screen-pixel vector representing 1 world-X unit at a world reference point
 * (typically the cannon's position) given the camera and viewport dimensions.
 */
export function computeWorldXPixelVector(
  camera: THREE.Camera,
  refWorldPos: { x: number; y: number; z: number },
  viewportWidth: number,
  viewportHeight: number
): Vector2D {
  const p0 = new THREE.Vector3(refWorldPos.x, refWorldPos.y, refWorldPos.z);
  const p1 = new THREE.Vector3(refWorldPos.x + 1.0, refWorldPos.y, refWorldPos.z);

  p0.project(camera);
  p1.project(camera);

  const px0 = ndcToPixel(p0.x, p0.y, viewportWidth, viewportHeight);
  const px1 = ndcToPixel(p1.x, p1.y, viewportWidth, viewportHeight);

  return {
    x: px1.x - px0.x,
    y: px1.y - px0.y
  };
}
