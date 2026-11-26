import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SlidingStatue } from '../sim/statues';

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

/**
 * Right-Lane Sliding Statue Queue Renderer (Stage 4).
 * Renders all 3 queue slots using 1 InstancedMesh (1 draw call)
 * plus 1 dynamic CanvasTexture HP/reward badge on Slot 1 (1 draw call).
 * Total: 2 draw calls.
 */
export class StatueRenderer {
  private scene: THREE.Scene;
  private statueMesh: THREE.InstancedMesh;
  private badgeMesh: THREE.Mesh;
  private badgeCanvas: HTMLCanvasElement;
  private badgeCtx: CanvasRenderingContext2D | null;
  private badgeTexture: THREE.CanvasTexture;
  private dummy: THREE.Object3D;

  private lastId: number = -1;
  private lastHp: number = -1;
  private visible: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();

    // 1. Merge stone pedestal + dark totem + glowing gold core (1 draw call for all 3 slots)
    const parts: THREE.BufferGeometry[] = [];

    const pedGeo = new THREE.CylinderGeometry(1.15, 1.35, 0.55, 8);
    pedGeo.translate(0, 0.275, 0);
    setGeometryColor(pedGeo, 0x334155);
    parts.push(pedGeo);

    const totemGeo = new THREE.BoxGeometry(1.05, 2.2, 1.05);
    totemGeo.translate(0, 1.65, 0);
    setGeometryColor(totemGeo, 0x1e293b);
    parts.push(totemGeo);

    const crownGeo = new THREE.BoxGeometry(1.2, 0.35, 1.2);
    crownGeo.translate(0, 2.85, 0);
    setGeometryColor(crownGeo, 0x475569);
    parts.push(crownGeo);

    const goldCoreGeo = new THREE.BoxGeometry(0.55, 0.65, 1.12);
    goldCoreGeo.translate(0, 1.85, 0);
    setGeometryColor(goldCoreGeo, 0xfacc15);
    parts.push(goldCoreGeo);

    const mergedGeo = BufferGeometryUtils.mergeGeometries(parts, false);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });

    this.statueMesh = new THREE.InstancedMesh(mergedGeo, mat, 3);
    this.statueMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.statueMesh.count = 0;
    this.statueMesh.visible = false;
    this.statueMesh.frustumCulled = false;
    this.scene.add(this.statueMesh);

    // 2. Slot 1 HP / Reward Badge (1 draw call)
    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 256;
    this.badgeCanvas.height = 128;
    this.badgeCtx = this.badgeCanvas.getContext('2d');
    this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
    this.badgeTexture.colorSpace = THREE.SRGBColorSpace;
    this.badgeTexture.minFilter = THREE.LinearFilter;
    this.badgeTexture.magFilter = THREE.LinearFilter;

    const badgeGeo = new THREE.PlaneGeometry(2.4, 1.2);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: this.badgeTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    this.badgeMesh.rotation.y = Math.PI;
    this.badgeMesh.visible = false;
    this.scene.add(this.badgeMesh);
  }

  public setVisible(isVisible: boolean): void {
    this.visible = isVisible;
    this.statueMesh.visible = isVisible;
    if (!isVisible) {
      this.badgeMesh.visible = false;
    }
  }

  public update(statues: readonly SlidingStatue[]): void {
    if (!this.visible) return;

    const count = Math.min(3, statues.length);
    this.statueMesh.count = count;

    for (let i = 0; i < count; i++) {
      const s = statues[i];
      // Slot 0 is full scale; queued slots 1 and 2 are slightly scaled down for visual clarity
      const scale = s.slotIndex === 0 ? 1.0 : s.slotIndex === 1 ? 0.88 : 0.78;
      this.dummy.position.set(s.x, 0, s.z);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.statueMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.statueMesh.instanceMatrix.needsUpdate = true;

    // Update Slot 0 badge
    const front = statues[0];
    if (front) {
      this.badgeMesh.visible = true;
      this.badgeMesh.position.set(front.x, 3.85, front.z);
      const roundedHp = Math.ceil(front.hp);
      if (front.id !== this.lastId || roundedHp !== this.lastHp) {
        this.lastId = front.id;
        this.lastHp = roundedHp;
        this.redrawBadge(front, roundedHp);
      }
    } else {
      this.badgeMesh.visible = false;
    }
  }

  private redrawBadge(statue: SlidingStatue, hp: number): void {
    const ctx = this.badgeCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 128);

    // Dark pill background with gold border
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 108, 18);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = statue.rewardKind === 'overdrive' ? '#f59e0b' : '#facc15';
    ctx.stroke();

    // Reward label
    const label =
      statue.rewardKind === 'tier'
        ? `TIER ${statue.rewardTier}`
        : 'OVERDRIVE';

    ctx.font = '800 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#facc15';
    ctx.fillText(label, 128, 40);

    // HP value
    ctx.font = '900 44px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${hp} HP`, 128, 86);

    this.badgeTexture.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.statueMesh);
    this.statueMesh.geometry.dispose();
    (this.statueMesh.material as THREE.Material).dispose();

    this.scene.remove(this.badgeMesh);
    this.badgeMesh.geometry.dispose();
    (this.badgeMesh.material as THREE.Material).dispose();
    this.badgeTexture.dispose();
  }
}
