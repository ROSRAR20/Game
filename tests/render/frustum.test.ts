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
    // Preset A: Close, yaw 15, pitch 52, fov 50, height 21, posX -4.8, posZ -4.0
    const presetA = makeCamera(52, 15, 50, 21, -4.8, -4.0, 25);
    const rangeA = computeFrustumGroundRange(presetA);

    // Preset B: Medium, yaw 25, pitch 55, fov 52, height 28, posX -8.0, posZ -3.5
    const presetB = makeCamera(55, 25, 52, 28, -8.0, -3.5, 30);
    const rangeB = computeFrustumGroundRange(presetB);

    // Preset C: Far / Wide, yaw 35, pitch 56, fov 54, height 38, posX -11.0, posZ -3.0
    const presetC = makeCamera(56, 35, 54, 38, -11.0, -3.0, 40);
    const rangeC = computeFrustumGroundRange(presetC);

    console.log('Preset A (Close - yaw 18, height 21):', {
      nearZ: Number(rangeA.nearZ.toFixed(2)),
      farZ: Number(rangeA.farZ.toFixed(2)),
      centerNearZ: Number(rangeA.centerNearZ.toFixed(2)),
      centerFarZ: Number(rangeA.centerFarZ.toFixed(2)),
      visibleRoadSpan: Number((rangeA.farZ - rangeA.nearZ).toFixed(2))
    });

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

    // Preset A visible span is around 35-40 units
    expect(rangeA.farZ - rangeA.nearZ).toBeGreaterThan(32);
    expect(rangeA.farZ - rangeA.nearZ).toBeLessThan(42);

    // Presets are distinctly different in yaw and span
    expect(rangeB.farZ - rangeB.nearZ).toBeGreaterThan(45);
    expect(rangeC.farZ - rangeC.nearZ).toBeGreaterThan(58);
  });
});
