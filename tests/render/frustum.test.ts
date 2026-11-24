import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeFrustumGroundRange } from '../../src/render/frustum';

describe('Frustum Ground Raycast', () => {
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

  it('computes exact ground range for Old Presets (height 42, 44, 45)', () => {
    const oldA = makeCamera(52, 20, 52, 42, -10, -7, 50);
    const rangeOldA = computeFrustumGroundRange(oldA);

    console.log('Old Preset A Raycast Ground Range:', {
      nearZ: Number(rangeOldA.nearZ.toFixed(2)),
      farZ: Number(rangeOldA.farZ.toFixed(2)),
      bottomCenter: rangeOldA.bottomCenter,
      topCenter: rangeOldA.topCenter,
      span: Number((rangeOldA.farZ - rangeOldA.nearZ).toFixed(2))
    });

    // Confirms user observation: visible ground spans Z from -1.6 to 80.6
    expect(rangeOldA.nearZ).toBeCloseTo(-1.59, 1);
    expect(rangeOldA.farZ).toBeCloseTo(80.56, 1);
  });

  it('computes exact ground range for Distinct Presets A (Close), B (Medium), C (Far)', () => {
    // User tuned camera: pitch 40, yaw 25.5, fov 56, height 20, posX -8.8, posZ -9, lookDist 16
    const userCam = makeCamera(40, 25.5, 56, 20, -8.8, -9, 16);
    const rangeUser = computeFrustumGroundRange(userCam);

    console.log('User Tuned Camera Ground Range:', {
      nearZ: Number(rangeUser.nearZ.toFixed(2)),
      farZ: Number(rangeUser.farZ.toFixed(2)),
      centerNearZ: Number(rangeUser.centerNearZ.toFixed(2)),
      centerFarZ: Number(rangeUser.centerFarZ.toFixed(2)),
      visibleRoadSpan: Number((rangeUser.farZ - rangeUser.nearZ).toFixed(2))
    });

    // Preset B: Medium, yaw 25, pitch 55, fov 52, height 28, posX -8.0, posZ -3.5
    const presetB = makeCamera(55, 25, 52, 28, -8.0, -3.5, 30);
    const rangeB = computeFrustumGroundRange(presetB);

    // Preset C: Far / Wide, yaw 35, pitch 56, fov 54, height 38, posX -11.0, posZ -3.0
    const presetC = makeCamera(56, 35, 54, 38, -11.0, -3.0, 40);
    const rangeC = computeFrustumGroundRange(presetC);

    // Preset A (User Tuned): pitch 40, yaw 25.5, fov 56, height 20, posX -8.8, posZ -9
    const rangeA = rangeUser;

    console.log('Preset B (Medium - yaw 25, height 28):', {
      nearZ: Number(rangeB.nearZ.toFixed(2)),
      farZ: Number(rangeB.farZ.toFixed(2)),
      centerNearZ: Number(rangeB.centerNearZ.toFixed(2)),
      centerFarZ: Number(rangeB.centerFarZ.toFixed(2)),
      visibleRoadSpan: Number((rangeB.farZ - rangeB.nearZ).toFixed(2))
    });

    console.log('Preset C (Far - yaw 35, height 38):', {
      nearZ: Number(rangeC.nearZ.toFixed(2)),
      farZ: Number(rangeC.farZ.toFixed(2)),
      centerNearZ: Number(rangeC.centerNearZ.toFixed(2)),
      centerFarZ: Number(rangeC.centerFarZ.toFixed(2)),
      visibleRoadSpan: Number((rangeC.farZ - rangeC.nearZ).toFixed(2))
    });

    // Preset A (User Tuned): visible ground range matches on-device verified values
    expect(rangeA.nearZ).toBeCloseTo(-3.72, 1);
    expect(rangeA.farZ).toBeCloseTo(84.91, 1);
    expect(rangeA.centerNearZ).toBeCloseTo(-1.71, 1);
    expect(rangeA.centerFarZ).toBeCloseTo(75.93, 1);

    // Presets are distinctly different in yaw and span
    expect(rangeB.farZ - rangeB.nearZ).toBeGreaterThan(45);
    expect(rangeC.farZ - rangeC.nearZ).toBeGreaterThan(58);
  });

  it('computes exact ground ranges and entity NDC projection for Proposed Camera Options A and B', () => {
    // Current Camera
    const currentCam = makeCamera(40, 25.5, 56, 20, -8.8, -9, 16);
    // Camera Option A: Symmetric Corridor (pitch 42, yaw 0, fov 56, height 22, posX 0, posZ -9)
    const optionACam = makeCamera(42, 0, 56, 22, 0, -9, 16.5);
    // Camera Option B: Balanced Diagonal (pitch 44, yaw 10, fov 54, height 23, posX -3.5, posZ -10)
    const optionBCam = makeCamera(44, 10, 54, 23, -3.5, -10, 18);

    const entities = [
      { name: 'Cannon Left', x: -5, z: 5 },
      { name: 'Cannon Center', x: 0, z: 5 },
      { name: 'Cannon Right', x: 5, z: 5 },
      { name: 'Road Edge Left (Z=5)', x: -6, z: 5 },
      { name: 'Road Edge Right (Z=5)', x: 6, z: 5 },
      { name: 'Crate (Z=8)', x: -4, z: 8 },
      { name: 'Statue (Z=14)', x: 4, z: 14 },
      { name: 'Centre Gate 1 (Z=18)', x: -1, z: 18 },
      { name: 'Centre Gate 2 (Z=18)', x: 1, z: 18 },
      { name: 'Left Tunnel Mouth (Z=22)', x: -6, z: 22 },
      { name: 'Mid-Line Center (Z=22)', x: 0, z: 22 },
      { name: 'Right Tunnel Mouth (Z=22)', x: 6, z: 22 },
      { name: 'Guardian Tower 1 (Z=30)', x: 0, z: 30 },
      { name: 'Boss 101 (Z=44)', x: 0, z: 44 },
      { name: 'Horde Carpet (Z=50)', x: 0, z: 50 },
    ];

    const projectToNDC = (cam: THREE.PerspectiveCamera, x: number, z: number) => {
      const v = new THREE.Vector3(x, 0, z);
      v.project(cam);
      return { ndcX: Number(v.x.toFixed(3)), ndcY: Number(v.y.toFixed(3)), inBounds: Math.abs(v.x) <= 1.0 && Math.abs(v.y) <= 1.0 };
    };

    console.log('\n=== NDC COMPARISON: CURRENT vs OPTION A vs OPTION B ===');
    const table = entities.map((e) => {
      const cur = projectToNDC(currentCam, e.x, e.z);
      const optA = projectToNDC(optionACam, e.x, e.z);
      const optB = projectToNDC(optionBCam, e.x, e.z);
      return {
        entity: e.name,
        pos: `(${e.x}, ${e.z})`,
        currentNDC: `(${cur.ndcX}, ${cur.ndcY}) ${cur.inBounds ? 'OK' : 'OUT'}`,
        optionANDC: `(${optA.ndcX}, ${optA.ndcY}) ${optA.inBounds ? 'OK' : 'OUT'}`,
        optionBNDC: `(${optB.ndcX}, ${optB.ndcY}) ${optB.inBounds ? 'OK' : 'OUT'}`
      };
    });
    console.table(table);

    const rangeA = computeFrustumGroundRange(optionACam);
    console.log('Camera Option A (Symmetric) Raycast Ground Range:', {
      nearZ: Number(rangeA.nearZ.toFixed(2)),
      farZ: Number(rangeA.farZ.toFixed(2)),
      centerNearZ: Number(rangeA.centerNearZ.toFixed(2)),
      centerFarZ: Number(rangeA.centerFarZ.toFixed(2)),
      span: Number((rangeA.farZ - rangeA.nearZ).toFixed(2))
    });

    const rangeB = computeFrustumGroundRange(optionBCam);
    console.log('Camera Option B (Balanced Diagonal) Raycast Ground Range:', {
      nearZ: Number(rangeB.nearZ.toFixed(2)),
      farZ: Number(rangeB.farZ.toFixed(2)),
      centerNearZ: Number(rangeB.centerNearZ.toFixed(2)),
      centerFarZ: Number(rangeB.centerFarZ.toFixed(2)),
      span: Number((rangeB.farZ - rangeB.nearZ).toFixed(2))
    });
  });
});
