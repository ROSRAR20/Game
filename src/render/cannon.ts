import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/constants';
import { CannonSim } from '../sim/cannon';

function setGeometryColor(geo: THREE.BufferGeometry, hexColor: number): THREE.BufferGeometry {
  const color = new THREE.Color(hexColor);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

export class CannonRender {
  public group: THREE.Group;
  private cannonSim: CannonSim;
  private bodyMesh: THREE.InstancedMesh;
  private ringMesh: THREE.InstancedMesh;
  private dummy: THREE.Object3D;

  constructor(scene: THREE.Scene, cannonSim: CannonSim) {
    this.cannonSim = cannonSim;
    this.group = new THREE.Group();
    this.dummy = new THREE.Object3D();

    // 1. Merge all solid cannon body parts into 1 single geometry with vertex colors (1 draw call)
    const geos: THREE.BufferGeometry[] = [];

    // Chassis platform
    const chassisGeo = new THREE.BoxGeometry(1.5, 0.3, 1.2);
    chassisGeo.translate(0, 0.15, 0);
    setGeometryColor(chassisGeo, CONFIG.COLORS.CANNON_CHASSIS);
    geos.push(chassisGeo);

    // Left tread
    const leftTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    leftTreadGeo.translate(-0.82, 0.175, 0);
    setGeometryColor(leftTreadGeo, CONFIG.COLORS.CANNON_TREADS);
    geos.push(leftTreadGeo);

    // Right tread
    const rightTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    rightTreadGeo.translate(0.82, 0.175, 0);
    setGeometryColor(rightTreadGeo, CONFIG.COLORS.CANNON_TREADS);
    geos.push(rightTreadGeo);

    // Turret Dome
    const domeGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.35, 12);
    domeGeo.translate(0, 0.45, 0);
    setGeometryColor(domeGeo, CONFIG.COLORS.CANNON_DOME);
    geos.push(domeGeo);

    // Main Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.0, 10);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0.45, 0.65);
    setGeometryColor(barrelGeo, CONFIG.COLORS.CANNON_BARREL);
    geos.push(barrelGeo);

    // Muzzle tip
    const muzzleGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 10);
    muzzleGeo.rotateX(Math.PI / 2);
    muzzleGeo.translate(0, 0.45, 1.15);
    setGeometryColor(muzzleGeo, CONFIG.COLORS.CANNON_MUZZLE);
    geos.push(muzzleGeo);

    const mergedBodyGeo = BufferGeometryUtils.mergeGeometries(geos, false);
    const bodyMat = new THREE.MeshLambertMaterial({
      vertexColors: true
    });
    // Multi-shooter instanced mesh: 1 to 6 shooters cost exactly 1 draw call
    this.bodyMesh = new THREE.InstancedMesh(mergedBodyGeo, bodyMat, 6);
    this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bodyMesh.count = 1;
    this.group.add(this.bodyMesh);

    // 2. Aim ground ring (transparent WebGL layer - 1 draw call for all 1..6 shooters)
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.CANNON_RING,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, 6);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.count = 1;
    this.group.add(this.ringMesh);

    this.group.position.set(0, 0, 0);
    scene.add(this.group);
    this.update();
  }

  public update(): void {
    const count = Math.max(1, Math.min(6, this.cannonSim.cannonCount));
    const offsets = CannonSim.getShooterOffsets(count);
    this.bodyMesh.count = count;
    this.ringMesh.count = count;

    for (let i = 0; i < count; i++) {
      this.dummy.position.set(this.cannonSim.x + offsets[i], 0, CONFIG.CANNON_Z);
      this.dummy.updateMatrix();
      this.bodyMesh.setMatrixAt(i, this.dummy.matrix);
      this.ringMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.bodyMesh.geometry.dispose();
    if (Array.isArray(this.bodyMesh.material)) {
      this.bodyMesh.material.forEach((m) => m.dispose());
    } else {
      this.bodyMesh.material.dispose();
    }
    this.ringMesh.geometry.dispose();
    if (Array.isArray(this.ringMesh.material)) {
      this.ringMesh.material.forEach((m) => m.dispose());
    } else {
      this.ringMesh.material.dispose();
    }
  }
}
