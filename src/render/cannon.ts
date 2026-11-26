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
  private tierMeshes: THREE.InstancedMesh[];
  private tier2Mat: THREE.MeshLambertMaterial;
  private ringMesh: THREE.InstancedMesh;
  private ringMat: THREE.MeshBasicMaterial;
  private dummy: THREE.Object3D;

  constructor(scene: THREE.Scene, cannonSim: CannonSim) {
    this.cannonSim = cannonSim;
    this.group = new THREE.Group();
    this.dummy = new THREE.Object3D();

    // Build 3 distinct per-tier geometries (Tier 0, Tier 1, Tier 2+ heavy rig).
    // Only the active tier's InstancedMesh is visible, so cost remains strictly 1 body draw call.
    // Tiers 2..9 use tier2Mat color tinting for distinct visual progression at 0 extra draw calls.
    const tier0Geo = this.buildTier0Geometry();
    const tier1Geo = this.buildTier1Geometry();
    const tier2Geo = this.buildTier2Geometry();

    const baseMat = new THREE.MeshLambertMaterial({
      vertexColors: true
    });
    this.tier2Mat = new THREE.MeshLambertMaterial({
      vertexColors: true
    });

    this.tierMeshes = [
      { geo: tier0Geo, mat: baseMat },
      { geo: tier1Geo, mat: baseMat },
      { geo: tier2Geo, mat: this.tier2Mat }
    ].map(({ geo, mat }, idx) => {
      const mesh = new THREE.InstancedMesh(geo, mat, 6);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 1;
      mesh.visible = idx === 0;
      this.group.add(mesh);
      return mesh;
    });

    // 2. Aim ground ring (transparent WebGL layer - 1 draw call for all 1..6 shooters)
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.CANNON_RING,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.ringMesh = new THREE.InstancedMesh(ringGeo, this.ringMat, 6);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.count = 1;
    this.group.add(this.ringMesh);

    this.group.position.set(0, 0, 0);
    scene.add(this.group);
    this.update();
  }

  private buildTier0Geometry(): THREE.BufferGeometry {
    // Tier 0: Single Field Cannon
    const geos: THREE.BufferGeometry[] = [];

    const chassisGeo = new THREE.BoxGeometry(1.5, 0.3, 1.2);
    chassisGeo.translate(0, 0.15, 0);
    setGeometryColor(chassisGeo, CONFIG.COLORS.CANNON_CHASSIS);
    geos.push(chassisGeo);

    const leftTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    leftTreadGeo.translate(-0.82, 0.175, 0);
    setGeometryColor(leftTreadGeo, CONFIG.COLORS.CANNON_TREADS);
    geos.push(leftTreadGeo);

    const rightTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    rightTreadGeo.translate(0.82, 0.175, 0);
    setGeometryColor(rightTreadGeo, CONFIG.COLORS.CANNON_TREADS);
    geos.push(rightTreadGeo);

    const domeGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.35, 12);
    domeGeo.translate(0, 0.45, 0);
    setGeometryColor(domeGeo, CONFIG.COLORS.CANNON_DOME);
    geos.push(domeGeo);

    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.0, 10);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0.45, 0.65);
    setGeometryColor(barrelGeo, CONFIG.COLORS.CANNON_BARREL);
    geos.push(barrelGeo);

    const muzzleGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 10);
    muzzleGeo.rotateX(Math.PI / 2);
    muzzleGeo.translate(0, 0.45, 1.15);
    setGeometryColor(muzzleGeo, CONFIG.COLORS.CANNON_MUZZLE);
    geos.push(muzzleGeo);

    return BufferGeometryUtils.mergeGeometries(geos, false);
  }

  private buildTier1Geometry(): THREE.BufferGeometry {
    // Tier 1: Wheeled Triple-Barrel Cannon Cluster
    const geos: THREE.BufferGeometry[] = [];

    const chassisGeo = new THREE.BoxGeometry(1.6, 0.34, 1.35);
    chassisGeo.translate(0, 0.17, 0);
    setGeometryColor(chassisGeo, 0x0c4a6e);
    geos.push(chassisGeo);

    const leftWheel = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10);
    leftWheel.rotateZ(Math.PI / 2);
    leftWheel.translate(-0.88, 0.32, 0);
    setGeometryColor(leftWheel, 0x0f172a);
    geos.push(leftWheel);

    const rightWheel = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10);
    rightWheel.rotateZ(Math.PI / 2);
    rightWheel.translate(0.88, 0.32, 0);
    setGeometryColor(rightWheel, 0x0f172a);
    geos.push(rightWheel);

    const domeGeo = new THREE.CylinderGeometry(0.55, 0.68, 0.4, 12);
    domeGeo.translate(0, 0.5, 0);
    setGeometryColor(domeGeo, 0x0ea5e9);
    geos.push(domeGeo);

    // Triple barrels
    for (const bx of [-0.32, 0, 0.32]) {
      const barrel = new THREE.CylinderGeometry(0.12, 0.15, 1.1, 8);
      barrel.rotateX(Math.PI / 2);
      barrel.translate(bx, 0.52, 0.7);
      setGeometryColor(barrel, 0x38bdf8);
      geos.push(barrel);

      const tip = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 8);
      tip.rotateX(Math.PI / 2);
      tip.translate(bx, 0.52, 1.25);
      setGeometryColor(tip, 0xfef08a);
      geos.push(tip);
    }

    return BufferGeometryUtils.mergeGeometries(geos, false);
  }

  private buildTier2Geometry(): THREE.BufferGeometry {
    // Tier 2: Armoured Trooper Squad (gold-trimmed heavy battle rig + twin plasma cannons)
    const geos: THREE.BufferGeometry[] = [];

    const baseGeo = new THREE.BoxGeometry(1.7, 0.4, 1.45);
    baseGeo.translate(0, 0.2, 0);
    setGeometryColor(baseGeo, 0x1e293b);
    geos.push(baseGeo);

    // Front armour shield
    const shieldGeo = new THREE.BoxGeometry(1.75, 0.45, 0.22);
    shieldGeo.translate(0, 0.52, 0.62);
    setGeometryColor(shieldGeo, 0xf59e0b);
    geos.push(shieldGeo);

    // Heavy armoured turret
    const coreGeo = new THREE.BoxGeometry(1.1, 0.55, 0.9);
    coreGeo.translate(0, 0.65, -0.05);
    setGeometryColor(coreGeo, 0x0284c7);
    geos.push(coreGeo);

    // Twin heavy flame/plasma barrels
    for (const bx of [-0.35, 0.35]) {
      const barrel = new THREE.CylinderGeometry(0.18, 0.22, 1.2, 10);
      barrel.rotateX(Math.PI / 2);
      barrel.translate(bx, 0.68, 0.72);
      setGeometryColor(barrel, 0xfacc15);
      geos.push(barrel);

      const tip = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 10);
      tip.rotateX(Math.PI / 2);
      tip.translate(bx, 0.68, 1.32);
      setGeometryColor(tip, 0xffffff);
      geos.push(tip);
    }

    return BufferGeometryUtils.mergeGeometries(geos, false);
  }

  public update(): void {
    const count = Math.max(1, Math.min(6, this.cannonSim.cannonCount));
    const offsets = CannonSim.getShooterOffsets(count);
    const tier = Math.max(0, Math.min(CONFIG.MAX_TIER, this.cannonSim.tier));
    const activeMeshIdx = tier >= 2 ? 2 : tier;

    for (let t = 0; t < this.tierMeshes.length; t++) {
      const mesh = this.tierMeshes[t];
      mesh.visible = t === activeMeshIdx;
      mesh.count = count;
    }
    this.ringMesh.count = count;

    // Apply per-tier visual tint for Tiers 2..9 (0 extra draw calls)
    if (tier >= 2) {
      const tierCfg = CONFIG.TIERS[tier] ?? CONFIG.TIERS[2];
      this.tier2Mat.color.setHex(tierCfg.color);
    }

    // Overdrive visual ring highlight (gold vs tier/cyan)
    if (this.cannonSim.overdriveTimer > 0) {
      this.ringMat.color.setHex(0xfacc15);
      this.ringMat.opacity = 0.9;
    } else if (tier >= 3) {
      const tierCfg = CONFIG.TIERS[tier] ?? CONFIG.TIERS[2];
      this.ringMat.color.setHex(tierCfg.color);
      this.ringMat.opacity = 0.78;
    } else {
      this.ringMat.color.setHex(CONFIG.COLORS.CANNON_RING);
      this.ringMat.opacity = 0.7;
    }

    const activeBodyMesh = this.tierMeshes[activeMeshIdx];
    for (let i = 0; i < count; i++) {
      this.dummy.position.set(this.cannonSim.x + offsets[i], 0, CONFIG.CANNON_Z);
      this.dummy.updateMatrix();
      activeBodyMesh.setMatrixAt(i, this.dummy.matrix);
      this.ringMesh.setMatrixAt(i, this.dummy.matrix);
    }
    activeBodyMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    for (const mesh of this.tierMeshes) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.ringMesh.geometry.dispose();
    this.ringMat.dispose();
  }
}
