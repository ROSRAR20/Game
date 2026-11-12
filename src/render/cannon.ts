import * as THREE from 'three';
import { CONFIG } from '../config/constants';
import { CannonSim } from '../sim/cannon';

export class CannonRender {
  public group: THREE.Group;
  private cannonSim: CannonSim;

  constructor(scene: THREE.Scene, cannonSim: CannonSim) {
    this.cannonSim = cannonSim;
    this.group = new THREE.Group();

    // Stylized low-poly cannon base
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.25, 12);
    const baseMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.CANNON
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.125;
    this.group.add(baseMesh);

    // Cannon barrel pointing along +Z
    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.7, 10);
    // Rotate barrel cylinder from Y-axis to Z-axis
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.CANNON_ACCENT
    });
    const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
    barrelMesh.position.set(0, 0.28, 0.35);
    this.group.add(barrelMesh);

    this.group.position.set(this.cannonSim.x, 0, CONFIG.CANNON_Z);
    scene.add(this.group);
  }

  public update(): void {
    // Sync rendered position from sim state
    this.group.position.x = this.cannonSim.x;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
