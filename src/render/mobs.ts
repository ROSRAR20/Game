import * as THREE from 'three';
import { CONFIG } from '../config/constants';
import { MobPool } from '../sim/pool';

export class MobRenderer {
  public mesh: THREE.InstancedMesh;
  public readonly trianglesPerUnit: number;
  private dummy: THREE.Object3D;

  constructor(scene: THREE.Scene, capacity: number = CONFIG.MAX_UNITS) {
    this.dummy = new THREE.Object3D();

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

    const indexCount = geometry.index ? geometry.index.count : 0;
    this.trianglesPerUnit = indexCount / 3;

    const material = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.BLUE_MOB
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;

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

    // Zero-allocation loop: mutates preallocated dummy transform
    for (let i = 0; i < activeCount; i++) {
      const slot = activeIndices[i];
      const w = weight[slot];

      // Subtle scale pulse if unit holds merged overflow weight
      const scale = w > 1 ? Math.min(1.4, 1.0 + (w - 1) * 0.08) : 1.0;

      this.dummy.position.set(x[slot], CONFIG.MOB_HEIGHT / 2, z[slot]);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
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
