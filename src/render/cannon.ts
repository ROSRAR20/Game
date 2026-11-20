import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/constants';
import { CannonSim } from '../sim/cannon';

function applyVertexColors(
  geo: THREE.BufferGeometry,
  hex: number
): THREE.BufferGeometry {
  const g = geo.clone();
  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < count; i++) {
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export class CannonRender {
  public group: THREE.Group;
  private cannonSim: CannonSim;

  // Tier Sub-groups
  private tier0Group: THREE.Group;
  private tier1Group: THREE.Group;
  private tier2Group: THREE.Group;

  private lastTier: number = -1;

  constructor(scene: THREE.Scene, cannonSim: CannonSim) {
    this.cannonSim = cannonSim;
    this.group = new THREE.Group();

    // 1. Build Tier 0: Single Cannon (3 draw calls: merged body + muzzle + ring)
    this.tier0Group = this.buildTier0();
    this.group.add(this.tier0Group);

    // 2. Build Tier 1: Clustered 3 Small Wheeled Field Cannons (3 draw calls: merged body + muzzles + ring)
    this.tier1Group = this.buildTier1();
    this.group.add(this.tier1Group);

    // 3. Build Tier 2: Squad of 6 Helmeted Troopers on Armored Base (2 draw calls: merged squad + ring)
    this.tier2Group = this.buildTier2();
    this.group.add(this.tier2Group);

    this.group.position.set(this.cannonSim.x, 0, CONFIG.CANNON_Z);
    scene.add(this.group);

    this.syncTierVisibility();
  }

  private buildTier0(): THREE.Group {
    const group = new THREE.Group();

    // Merged body parts with vertex colors
    const parts: THREE.BufferGeometry[] = [];

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(1.5, 0.3, 1.2);
    chassisGeo.translate(0, 0.15, 0);
    parts.push(applyVertexColors(chassisGeo, CONFIG.COLORS.CANNON_CHASSIS));

    // Left tread
    const leftTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    leftTreadGeo.translate(-0.82, 0.175, 0);
    parts.push(applyVertexColors(leftTreadGeo, CONFIG.COLORS.CANNON_TREADS));

    // Right tread
    const rightTreadGeo = new THREE.BoxGeometry(0.35, 0.35, 1.3);
    rightTreadGeo.translate(0.82, 0.175, 0);
    parts.push(applyVertexColors(rightTreadGeo, CONFIG.COLORS.CANNON_TREADS));

    // Dome
    const domeGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.35, 12);
    domeGeo.translate(0, 0.45, 0);
    parts.push(applyVertexColors(domeGeo, CONFIG.COLORS.CANNON_DOME));

    // Main Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.0, 10);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0.45, 0.65);
    parts.push(applyVertexColors(barrelGeo, CONFIG.COLORS.CANNON_BARREL));

    // Muzzle ring
    const muzzleGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 10);
    muzzleGeo.rotateX(Math.PI / 2);
    muzzleGeo.translate(0, 0.45, 1.15);
    parts.push(applyVertexColors(muzzleGeo, CONFIG.COLORS.CANNON_MUZZLE));

    const mergedBody = BufferGeometryUtils.mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());

    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const bodyMesh = new THREE.Mesh(mergedBody, bodyMat);
    group.add(bodyMesh);

    // Ground aim ring
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 24);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0.02, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.CANNON_RING,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    return group;
  }

  private buildTier1(): THREE.Group {
    const group = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];

    // Clustered 3 small wheeled field cannons:
    // Center: X = 0, Z = 0.25
    // Left: X = -0.7, Z = -0.15, angle = +5 deg
    // Right: X = 0.7, Z = -0.15, angle = -5 deg
    const guns = [
      { x: 0, z: 0.25, rotY: 0 },
      { x: -0.7, z: -0.15, rotY: 0.08 },
      { x: 0.7, z: -0.15, rotY: -0.08 }
    ];

    for (const g of guns) {
      // Carriage trail box
      const carriageGeo = new THREE.BoxGeometry(0.42, 0.2, 0.65);
      carriageGeo.translate(0, 0.16, 0);
      carriageGeo.rotateY(g.rotY);
      carriageGeo.translate(g.x, 0, g.z);
      parts.push(applyVertexColors(carriageGeo, 0x1e3a8a));

      // Left wheel (spoked cylinder)
      const leftWheel = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10);
      leftWheel.rotateZ(Math.PI / 2);
      leftWheel.translate(-0.25, 0.22, 0);
      leftWheel.rotateY(g.rotY);
      leftWheel.translate(g.x, 0, g.z);
      parts.push(applyVertexColors(leftWheel, 0x78350f));

      // Right wheel
      const rightWheel = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10);
      rightWheel.rotateZ(Math.PI / 2);
      rightWheel.translate(0.25, 0.22, 0);
      rightWheel.rotateY(g.rotY);
      rightWheel.translate(g.x, 0, g.z);
      parts.push(applyVertexColors(rightWheel, 0x78350f));

      // Field gun barrel
      const barrel = new THREE.CylinderGeometry(0.1, 0.14, 0.72, 10);
      barrel.rotateX(Math.PI / 2);
      barrel.translate(0, 0.26, 0.35);
      barrel.rotateY(g.rotY);
      barrel.translate(g.x, 0, g.z);
      parts.push(applyVertexColors(barrel, 0x60a5fa));

      // Muzzle tip
      const muzzle = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 10);
      muzzle.rotateX(Math.PI / 2);
      muzzle.translate(0, 0.26, 0.72);
      muzzle.rotateY(g.rotY);
      muzzle.translate(g.x, 0, g.z);
      parts.push(applyVertexColors(muzzle, 0x93c5fd));
    }

    const mergedBody = BufferGeometryUtils.mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());

    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const bodyMesh = new THREE.Mesh(mergedBody, bodyMat);
    group.add(bodyMesh);

    // Ground aim ring (wider to encircle the 3 clustered cannons)
    const ringGeo = new THREE.RingGeometry(1.05, 1.22, 24);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0.02, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    return group;
  }

  private buildTier2(): THREE.Group {
    const group = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];

    // 1. Armored mobile skiff platform
    const skiffGeo = new THREE.BoxGeometry(1.7, 0.12, 1.3);
    skiffGeo.translate(0, 0.06, 0);
    parts.push(applyVertexColors(skiffGeo, 0x1e293b));

    // Skiff bumper guard rails
    const bumperGeo = new THREE.BoxGeometry(1.8, 0.08, 0.1);
    bumperGeo.translate(0, 0.12, 0.62);
    parts.push(applyVertexColors(bumperGeo, 0x0f172a));

    // 2. Squad of 6 Helmeted Troopers in 2 staggered ranks
    // Front rank: X in [-0.55, 0, 0.55], Z = 0.2
    // Rear rank: X in [-0.4, 0, 0.4], Z = -0.3
    const troopers = [
      { x: -0.55, z: 0.2 },
      { x: 0, z: 0.25 },
      { x: 0.55, z: 0.2 },
      { x: -0.38, z: -0.28 },
      { x: 0, z: -0.25 },
      { x: 0.38, z: -0.28 }
    ];

    for (const t of troopers) {
      // Armored boots / legs
      const legs = new THREE.BoxGeometry(0.2, 0.24, 0.16);
      legs.translate(t.x, 0.22, t.z);
      parts.push(applyVertexColors(legs, 0x0f172a));

      // Torso / Cuirass (bronze plate armor)
      const torso = new THREE.BoxGeometry(0.26, 0.28, 0.2);
      torso.translate(t.x, 0.46, t.z);
      parts.push(applyVertexColors(torso, 0xd97706));

      // Glowing power core on chest
      const core = new THREE.BoxGeometry(0.1, 0.1, 0.04);
      core.translate(t.x, 0.47, t.z + 0.11);
      parts.push(applyVertexColors(core, 0xfbbf24));

      // Helmet
      const helmet = new THREE.CylinderGeometry(0.11, 0.12, 0.2, 8);
      helmet.translate(t.x, 0.68, t.z);
      parts.push(applyVertexColors(helmet, 0x78350f));

      // Horizontal visor slit (glowing cyan visor)
      const visor = new THREE.BoxGeometry(0.14, 0.04, 0.06);
      visor.translate(t.x, 0.69, t.z + 0.1);
      parts.push(applyVertexColors(visor, 0x00f5ff));

      // Forward-pointed assault carbine rifle
      const gun = new THREE.BoxGeometry(0.07, 0.08, 0.42);
      gun.translate(t.x + 0.15, 0.46, t.z + 0.18);
      parts.push(applyVertexColors(gun, 0x334155));

      // Carbine glowing emitter tip
      const tip = new THREE.BoxGeometry(0.08, 0.09, 0.08);
      tip.translate(t.x + 0.15, 0.46, t.z + 0.39);
      parts.push(applyVertexColors(tip, 0xf59e0b));
    }

    const mergedSquad = BufferGeometryUtils.mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());

    const squadMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const squadMesh = new THREE.Mesh(mergedSquad, squadMat);
    group.add(squadMesh);

    // Glowing amber squad rally ring
    const ringGeo = new THREE.RingGeometry(1.05, 1.25, 24);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0.02, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    return group;
  }

  private syncTierVisibility(): void {
    const tier = this.cannonSim.tier;
    this.tier0Group.visible = tier === 0;
    this.tier1Group.visible = tier === 1;
    this.tier2Group.visible = tier === 2;
    this.lastTier = tier;
  }

  public update(): void {
    // Sync lateral position from sim state
    this.group.position.x = this.cannonSim.x;

    // Toggle active tier mesh visibility
    if (this.cannonSim.tier !== this.lastTier) {
      this.syncTierVisibility();
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
