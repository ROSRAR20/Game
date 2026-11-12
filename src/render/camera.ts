import * as THREE from 'three';
import { CONFIG } from '../config/constants';
import { ViewportSize } from './viewport';

export function createCamera(size: ViewportSize): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA_FOV,
    size.aspect,
    CONFIG.CAMERA_NEAR,
    CONFIG.CAMERA_FAR
  );

  camera.position.set(
    CONFIG.CAMERA_OFFSET.x,
    CONFIG.CAMERA_OFFSET.y,
    CONFIG.CAMERA_OFFSET.z
  );

  camera.lookAt(
    CONFIG.CAMERA_LOOK_AT.x,
    CONFIG.CAMERA_LOOK_AT.y,
    CONFIG.CAMERA_LOOK_AT.z
  );

  return camera;
}

export function updateCameraAspect(
  camera: THREE.PerspectiveCamera,
  size: ViewportSize
): void {
  camera.aspect = size.aspect;
  camera.updateProjectionMatrix();
}
