import * as THREE from 'three';

export interface GroundPoint {
  x: number;
  z: number;
}

export interface FrustumGroundRange {
  bottomLeft: GroundPoint | null;
  bottomCenter: GroundPoint | null;
  bottomRight: GroundPoint | null;
  topLeft: GroundPoint | null;
  topCenter: GroundPoint | null;
  topRight: GroundPoint | null;
  nearZ: number;
  farZ: number;
  centerNearZ: number;
  centerFarZ: number;
}

/**
 * Casts a ray through an NDC coordinate (ndcX, ndcY in [-1, 1]) and finds its
 * intersection with the ground plane Y = 0.
 * Returns null if the ray is parallel to the ground or points toward the sky/horizon.
 */
export function raycastNDCtoGround(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number
): GroundPoint | null {
  const v = new THREE.Vector3(ndcX, ndcY, 0.5);
  v.unproject(camera);
  const rayDir = v.sub(camera.position).normalize();

  if (rayDir.y >= -1e-5) {
    return null;
  }

  const t = -camera.position.y / rayDir.y;
  if (t <= 0) {
    return null;
  }

  return {
    x: camera.position.x + rayDir.x * t,
    z: camera.position.z + rayDir.z * t
  };
}

/**
 * Computes the visible ground range on Y = 0 by raycasting the 4 corners
 * and top/bottom centers of the viewport frustum.
 */
export function computeFrustumGroundRange(camera: THREE.Camera): FrustumGroundRange {
  const bl = raycastNDCtoGround(camera, -1, -1);
  const bc = raycastNDCtoGround(camera, 0, -1);
  const br = raycastNDCtoGround(camera, 1, -1);
  const tl = raycastNDCtoGround(camera, -1, 1);
  const tc = raycastNDCtoGround(camera, 0, 1);
  const tr = raycastNDCtoGround(camera, 1, 1);

  const bottomZs: number[] = [];
  if (bl) bottomZs.push(bl.z);
  if (bc) bottomZs.push(bc.z);
  if (br) bottomZs.push(br.z);

  const topZs: number[] = [];
  if (tl) topZs.push(tl.z);
  if (tc) topZs.push(tc.z);
  if (tr) topZs.push(tr.z);

  const nearZ = bottomZs.length > 0 ? Math.min(...bottomZs) : 0;
  const farZ = topZs.length === 3 ? Math.max(...topZs) : Infinity;

  return {
    bottomLeft: bl,
    bottomCenter: bc,
    bottomRight: br,
    topLeft: tl,
    topCenter: tc,
    topRight: tr,
    nearZ,
    farZ,
    centerNearZ: bc ? bc.z : nearZ,
    centerFarZ: tc ? tc.z : farZ
  };
}
