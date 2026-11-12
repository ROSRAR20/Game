import * as THREE from 'three';
import { CONFIG } from '../config/constants';

export class BareStressTest {
  public mesh: THREE.InstancedMesh;
  public readonly count: number;
  public readonly trianglesPerUnit: number;

  private x: Float32Array;
  private z: Float32Array;
  private speed: Float32Array;
  private dummy: THREE.Object3D;

  constructor(scene: THREE.Scene, count: number) {
    this.count = count;
    this.x = new Float32Array(count);
    this.z = new Float32Array(count);
    this.speed = new Float32Array(count);
    this.dummy = new THREE.Object3D();

    // 100-triangle unit mesh for realistic stress benchmarking
    const geometry = new THREE.CylinderGeometry(
      CONFIG.MOB_RADIUS * 0.9,
      CONFIG.MOB_RADIUS * 1.05,
      CONFIG.MOB_HEIGHT,
      10,
      4
    );
    this.trianglesPerUnit = geometry.index ? geometry.index.count / 3 : 0;

    const material = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.STRESS_CUBE
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize random positions spread across the road
    for (let i = 0; i < count; i++) {
      this.x[i] = ((Math.random() - 0.5) * 2) * (CONFIG.ROAD_WIDTH / 2 - 0.8);
      this.z[i] = 2 + Math.random() * (CONFIG.ROAD_LENGTH - 4);
      this.speed[i] = 8 + Math.random() * 6;

      this.dummy.position.set(this.x[i], CONFIG.MOB_HEIGHT / 2, this.z[i]);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  public update(dt: number): void {
    const minZ = 1;
    const maxZ = CONFIG.ROAD_LENGTH - 1;

    for (let i = 0; i < this.count; i++) {
      let currentZ = this.z[i] + this.speed[i] * dt;
      if (currentZ > maxZ) {
        currentZ = minZ + (currentZ - maxZ);
      }
      this.z[i] = currentZ;

      this.dummy.position.set(this.x[i], CONFIG.MOB_HEIGHT / 2, currentZ);
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
