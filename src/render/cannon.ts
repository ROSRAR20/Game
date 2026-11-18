import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/constants';
import { CannonSim } from '../sim/cannon';

export class CannonRender {
  public group: THREE.Group;
  private cannonSim: CannonSim;
  private domeMat: THREE.MeshLambertMaterial;
  private muzzleMat: THREE.MeshBasicMaterial;
  private ringMat: THREE.MeshBasicMaterial;
  private lastTier: number = 0;

  constructor(scene: THREE.Scene, cannonSim: CannonSim) {
    this.cannonSim = cannonSim;
    this.group = new THREE.Group();

    // 1. Unified Chassis and Side Treads (merged into 1 mesh, saves 2 draw calls!)
    const chassisGeo = new THREE.BoxGeometry(1.5, 0.3, 1.2);
    chassisGeo.translate(0, 0.15, 0);

    const leftTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    leftTreadGeo.translate(-0.82, 0.175, 0);

    const rightTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    rightTreadGeo.translate(0.82, 0.175, 0);

    const mergedChassisGeo = BufferGeometryUtils.mergeGeometries(
      [chassisGeo, leftTreadGeo, rightTreadGeo],
      false
    );
    if (!mergedChassisGeo) {
      throw new Error('[CannonRender] mergeGeometries returned null');
    }
    chassisGeo.dispose();
    leftTreadGeo.dispose();
    rightTreadGeo.dispose();

    const chassisMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.CANNON_CHASSIS
    });
    const chassis = new THREE.Mesh(mergedChassisGeo, chassisMat);
    this.group.add(chassis);

    // 3. Turret Dome
    const domeGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.35, 12);
    this.domeMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.CANNON_DOME
    });
    const dome = new THREE.Mesh(domeGeo, this.domeMat);
    dome.position.y = 0.45;
    this.group.add(dome);

    // 4. Main Barrel pointing forward along +Z
    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.0, 10);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.CANNON_BARREL
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0.45, 0.65);
    this.group.add(barrel);

    // 5. High-contrast muzzle ring at barrel tip
    const muzzleGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 10);
    muzzleGeo.rotateX(Math.PI / 2);
    this.muzzleMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.CANNON_MUZZLE
    });
    const muzzle = new THREE.Mesh(muzzleGeo, this.muzzleMat);
    muzzle.position.set(0, 0.45, 1.15);
    this.group.add(muzzle);

    // 6. Glowing aim / base ring on ground
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.CANNON_RING,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    ring.position.y = 0.02;
    this.group.add(ring);

    this.group.position.set(this.cannonSim.x, 0, CONFIG.CANNON_Z);
    scene.add(this.group);
  }

  public update(): void {
    // Sync rendered position from sim state
    this.group.position.x = this.cannonSim.x;

    // Visual tier progression updates
    if (this.cannonSim.tier !== this.lastTier) {
      this.lastTier = this.cannonSim.tier;
      if (this.lastTier === 2) {
        this.domeMat.color.setHex(0x7c2d12);
        this.muzzleMat.color.setHex(0xfbbf24);
        this.ringMat.color.setHex(0xf59e0b);
      } else if (this.lastTier === 1) {
        this.domeMat.color.setHex(0x1e3a8a);
        this.muzzleMat.color.setHex(0x60a5fa);
        this.ringMat.color.setHex(0x2563eb);
      } else {
        this.domeMat.color.setHex(CONFIG.COLORS.CANNON_DOME);
        this.muzzleMat.color.setHex(CONFIG.COLORS.CANNON_MUZZLE);
        this.ringMat.color.setHex(CONFIG.COLORS.CANNON_RING);
      }
    }
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
