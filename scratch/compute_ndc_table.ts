import * as THREE from 'three';

function makeCamera(
  pitchDeg: number,
  yawDeg: number,
  fov: number,
  height: number,
  posX: number,
  posZ: number,
  lookDist: number = 30,
  aspect: number = 390 / 844
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const yawRad = (yawDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(yawRad) * Math.cos(pitchRad),
    -Math.sin(pitchRad),
    Math.cos(yawRad) * Math.cos(pitchRad)
  );
  camera.position.set(posX, height, posZ);
  camera.up.set(0, 1, 0);
  camera.lookAt(camera.position.clone().add(dir.multiplyScalar(lookDist)));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

const currentCam = makeCamera(40, 25.5, 56, 20, -8.8, -9, 16);
const optionBCam = makeCamera(44, 10, 54, 23, -3.5, -10, 18);
const middleCam = makeCamera(44, 16.0, 60, 24.5, -5.2, -11.5, 20);

const entities = [
  { name: 'Road Edge Left (Z=5)', x: -6, z: 5 },
  { name: 'Cannon Left', x: -5, z: 5 },
  { name: 'Cannon Center', x: 0, z: 5 },
  { name: 'Cannon Right', x: 5, z: 5 },
  { name: 'Road Edge Right (Z=5)', x: 6, z: 5 },
  { name: 'Left Tunnel Mouth (Z=22)', x: -6, z: 22 },
  { name: 'Centre Gate 1 (Z=18)', x: -1, z: 18 },
  { name: 'Centre Gate 2 (Z=18)', x: 1, z: 18 },
  { name: 'Mid-Line Center (Z=22)', x: 0, z: 22 },
  { name: 'Right Tunnel Mouth (Z=22)', x: 6, z: 22 },
  { name: 'Boss Spawn (Z=44)', x: 0, z: 44 },
  { name: 'Horde Carpet (Z=50)', x: 0, z: 50 },
];

function project(cam: THREE.PerspectiveCamera, x: number, z: number) {
  const v = new THREE.Vector3(x, 0, z);
  v.project(cam);
  const px = Math.round(((v.x + 1) / 2) * 390);
  const py = Math.round(((1 - v.y) / 2) * 844);
  return {
    ndcX: Number(v.x.toFixed(3)),
    ndcY: Number(v.y.toFixed(3)),
    pixelX: px,
    pixelY: py,
    inBounds: Math.abs(v.x) <= 1.0 && Math.abs(v.y) <= 1.0
  };
}

console.log('=== EXACT NDC & PIXEL PROJECTION (390x844) ===');
for (const e of entities) {
  const cur = project(currentCam, e.x, e.z);
  const optB = project(optionBCam, e.x, e.z);
  const mid = project(middleCam, e.x, e.z);
  console.log(JSON.stringify({
    entity: e.name,
    world: `(${e.x}, ${e.z})`,
    currentNDC: `(${cur.ndcX}, ${cur.ndcY}) [px: ${cur.pixelX}, ${cur.pixelY}] ${cur.inBounds ? 'OK' : 'CLIPPED'}`,
    optionBNDC: `(${optB.ndcX}, ${optB.ndcY}) [px: ${optB.pixelX}, ${optB.pixelY}] ${optB.inBounds ? 'OK' : 'CLIPPED'}`,
    middleNDC: `(${mid.ndcX}, ${mid.ndcY}) [px: ${mid.pixelX}, ${mid.pixelY}] ${mid.inBounds ? 'OK' : 'CLIPPED'}`
  }));
}
