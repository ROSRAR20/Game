import * as THREE from 'three';
import { CameraConfig, getEffectiveCameraConfig } from '../config/constants';
import { ViewportSize } from './viewport';

/**
 * Applies pitch, yaw, height and look-at target positioning to a PerspectiveCamera.
 * Guarantees zero roll: camera.up remains strictly (0, 1, 0) so vertical lines remain vertical.
 */
export function applyCameraTuning(
  camera: THREE.PerspectiveCamera,
  cfg: CameraConfig
): void {
  camera.fov = cfg.fov;
  camera.near = cfg.near;
  camera.far = cfg.far;

  const pitchRad = (cfg.pitch * Math.PI) / 180;
  const yawRad = (cfg.yaw * Math.PI) / 180;

  // View direction derived from pitch (downward from horizontal) and yaw (rotation around Y)
  const dir = new THREE.Vector3(
    Math.sin(yawRad) * Math.cos(pitchRad),
    -Math.sin(pitchRad),
    Math.cos(yawRad) * Math.cos(pitchRad)
  );

  camera.position.set(cfg.posX, cfg.height, cfg.posZ);
  camera.up.set(0, 1, 0);

  const target = camera.position.clone().add(dir.multiplyScalar(cfg.lookAtDistance));
  camera.lookAt(target);

  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
}

export function createCamera(
  size: ViewportSize,
  cfg: CameraConfig = getEffectiveCameraConfig()
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    cfg.fov,
    size.aspect,
    cfg.near,
    cfg.far
  );

  applyCameraTuning(camera, cfg);

  return camera;
}

export function updateCameraAspect(
  camera: THREE.PerspectiveCamera,
  size: ViewportSize
): void {
  camera.aspect = size.aspect;
  camera.updateProjectionMatrix();
}
