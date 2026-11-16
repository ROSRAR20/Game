import * as THREE from 'three';
import { CONFIG } from '../config/constants';
import { MobPool } from '../sim/pool';

export class MobRenderer {
  public blueMesh: THREE.InstancedMesh;
  public redMesh: THREE.InstancedMesh;
  public readonly trianglesPerUnit: number;

  private blueMatrixArray: Float32Array;
  private redMatrixArray: Float32Array;
  private frustum: THREE.Frustum;
  private projScreenMatrix: THREE.Matrix4;
  private tempPoint: THREE.Vector3;

  public get mesh(): THREE.InstancedMesh {
    return this.blueMesh;
  }

  constructor(scene: THREE.Scene, capacity: number = CONFIG.MAX_UNITS) {
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
    this.tempPoint = new THREE.Vector3();

    // Stylized low-poly unit mesh with exactly 100 triangles (realistic GPU vertex load)
    // 10 radial segments, 4 height segments:
    // Sides: 10 * 4 * 2 = 80 tris; Top: 10 tris; Bottom: 10 tris; Total = 100 tris
    const geometry = new THREE.CylinderGeometry(
      CONFIG.MOB_RADIUS * 0.9,
      CONFIG.MOB_RADIUS * 1.05,
      CONFIG.MOB_HEIGHT,
      10,
      4
    );

    // Ensure broad bounding sphere covering entire road
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, CONFIG.ROAD_LENGTH / 2),
      CONFIG.ROAD_LENGTH
    );

    const indexCount = geometry.index ? geometry.index.count : 0;
    this.trianglesPerUnit = indexCount / 3;

    // Vibrant arcade blue material for Team 0 (Player)
    const blueMaterial = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.BLUE_MOB,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25
    });

    // High-contrast crimson red material for Team 1 (Enemy Horde)
    const redMaterial = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.RED_MOB,
      emissive: 0x991b1b,
      emissiveIntensity: 0.25
    });

    this.blueMesh = new THREE.InstancedMesh(geometry, blueMaterial, capacity);
    this.blueMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blueMesh.count = 0;
    this.blueMesh.frustumCulled = false;

    this.redMesh = new THREE.InstancedMesh(geometry, redMaterial, capacity);
    this.redMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.redMesh.count = 0;
    this.redMesh.frustumCulled = false;

    // Pre-initialize identity matrix elements in typed array buffers
    this.blueMatrixArray = this.blueMesh.instanceMatrix.array as Float32Array;
    this.redMatrixArray = this.redMesh.instanceMatrix.array as Float32Array;

    for (let i = 0; i < capacity; i++) {
      const idx = i * 16;
      this.blueMatrixArray[idx + 0] = 1;
      this.blueMatrixArray[idx + 5] = 1;
      this.blueMatrixArray[idx + 10] = 1;
      this.blueMatrixArray[idx + 15] = 1;

      this.redMatrixArray[idx + 0] = 1;
      this.redMatrixArray[idx + 5] = 1;
      this.redMatrixArray[idx + 10] = 1;
      this.redMatrixArray[idx + 15] = 1;
    }

    scene.add(this.blueMesh);
    scene.add(this.redMesh);
  }

  public update(pool: MobPool): void {
    const totalCount = pool.count;
    if (totalCount === 0) {
      this.blueMesh.count = 0;
      this.redMesh.count = 0;
      return;
    }

    const activeIndices = pool.activeIndices;
    const x = pool.x;
    const z = pool.z;
    const team = pool.team;
    const weight = pool.weight;
    const blueArr = this.blueMatrixArray;
    const redArr = this.redMatrixArray;
    const y = CONFIG.MOB_HEIGHT / 2;

    let blueCount = 0;
    let redCount = 0;

    // High-performance single-pass partition into Blue and Red matrix buffers
    for (let i = 0; i < totalCount; i++) {
      const slot = activeIndices[i];
      const w = weight[slot];
      const s = w > 1 ? Math.min(1.4, 1.0 + (w - 1) * 0.08) : 1.0;

      if (team[slot] === 0) {
        // Team 0: Player Blue
        const idx = blueCount * 16;
        blueArr[idx + 0] = s;
        blueArr[idx + 5] = s;
        blueArr[idx + 10] = s;
        blueArr[idx + 12] = x[slot];
        blueArr[idx + 13] = y;
        blueArr[idx + 14] = z[slot];
        blueCount++;
      } else {
        // Team 1: Enemy Red
        const idx = redCount * 16;
        redArr[idx + 0] = s;
        redArr[idx + 5] = s;
        redArr[idx + 10] = s;
        redArr[idx + 12] = x[slot];
        redArr[idx + 13] = y;
        redArr[idx + 14] = z[slot];
        redCount++;
      }
    }

    this.blueMesh.count = blueCount;
    this.redMesh.count = redCount;

    if (blueCount > 0) {
      this.blueMesh.instanceMatrix.needsUpdate = true;
    }
    if (redCount > 0) {
      this.redMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Calculates the exact number of active units currently inside the camera's view frustum.
   * Zero allocation: reuses preallocated projection matrices and vectors.
   */
  public countVisibleUnits(camera: THREE.Camera, pool: MobPool): number {
    if (pool.count === 0) return 0;

    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    let visible = 0;
    const count = pool.count;
    const activeIndices = pool.activeIndices;
    const x = pool.x;
    const z = pool.z;
    const y = CONFIG.MOB_HEIGHT / 2;

    for (let i = 0; i < count; i++) {
      const slot = activeIndices[i];
      this.tempPoint.set(x[slot], y, z[slot]);
      if (this.frustum.containsPoint(this.tempPoint)) {
        visible++;
      }
    }

    return visible;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.blueMesh);
    scene.remove(this.redMesh);
    this.blueMesh.geometry.dispose();

    if (Array.isArray(this.blueMesh.material)) {
      this.blueMesh.material.forEach((m) => m.dispose());
    } else {
      this.blueMesh.material.dispose();
    }

    if (Array.isArray(this.redMesh.material)) {
      this.redMesh.material.forEach((m) => m.dispose());
    } else {
      this.redMesh.material.dispose();
    }
  }
}
