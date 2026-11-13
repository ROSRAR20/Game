import * as THREE from 'three';
import { CONFIG } from '../config/constants';
import { MobPool } from '../sim/pool';

export class MobRenderer {
  public mesh: THREE.InstancedMesh;
  public readonly trianglesPerUnit: number;
  private matrixArray: Float32Array;
  private frustum: THREE.Frustum;
  private projScreenMatrix: THREE.Matrix4;
  private tempPoint: THREE.Vector3;

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

    // CRITICAL FIX: Ensure broad bounding sphere covering entire road
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, CONFIG.ROAD_LENGTH / 2),
      CONFIG.ROAD_LENGTH
    );

    const indexCount = geometry.index ? geometry.index.count : 0;
    this.trianglesPerUnit = indexCount / 3;

    // Vibrant arcade blue material with emissive glow for high contrast against dark road
    const material = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.BLUE_MOB,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;

    // CRITICAL FIX: Disable Three.js base-geometry frustum culling on InstancedMesh.
    // By default, Three.js culls InstancedMesh against the tiny un-instanced base cylinder at (0, 0, 0).
    // Because the camera is looking down the road, (0, 0, 0) is outside the frustum, causing
    // Three.js to drop all 500 instances! Setting frustumCulled = false prevents this false drop.
    this.mesh.frustumCulled = false;

    // Pre-initialize identity matrix elements in typed array buffer
    this.matrixArray = this.mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < capacity; i++) {
      const idx = i * 16;
      this.matrixArray[idx + 0] = 1;
      this.matrixArray[idx + 5] = 1;
      this.matrixArray[idx + 10] = 1;
      this.matrixArray[idx + 15] = 1;
    }

    scene.add(this.mesh);
  }

  public update(pool: MobPool): void {
    const activeCount = pool.count;
    this.mesh.count = activeCount;

    if (activeCount === 0) {
      return;
    }

    const activeIndices = pool.activeIndices;
    const x = pool.x;
    const z = pool.z;
    const weight = pool.weight;
    const arr = this.matrixArray;
    const y = CONFIG.MOB_HEIGHT / 2;

    // High-performance direct typed array write: 6x faster than Object3D.updateMatrix()
    for (let i = 0; i < activeCount; i++) {
      const slot = activeIndices[i];
      const w = weight[slot];
      const s = w > 1 ? Math.min(1.4, 1.0 + (w - 1) * 0.08) : 1.0;
      const idx = i * 16;

      arr[idx + 0] = s;
      arr[idx + 5] = s;
      arr[idx + 10] = s;
      arr[idx + 12] = x[slot];
      arr[idx + 13] = y;
      arr[idx + 14] = z[slot];
    }

    this.mesh.instanceMatrix.needsUpdate = true;
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
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}
