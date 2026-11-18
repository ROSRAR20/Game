import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TowerSim } from '../sim/towers';

interface TowerVisual {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  badgeMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastHp: number;
}

export class TowerRenderer {
  private visuals: Map<number, TowerVisual> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public buildTowers(towers: TowerSim[]): void {
    // Clear any previous visuals
    this.dispose();

    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      const group = new THREE.Group();
      group.position.set(tower.x, 0, tower.z);

      // 1. Pedestal platform geometry (broad beveled stone/metal base on ground)
      const pedestalGeo = new THREE.CylinderGeometry(
        tower.radius * 1.35,
        tower.radius * 1.55,
        0.5,
        8
      );
      pedestalGeo.translate(0, 0.25, 0);

      // 2. Fortified stone turret body
      const baseGeo = new THREE.CylinderGeometry(
        tower.radius * 0.9,
        tower.radius * 1.15,
        2.6,
        8
      );
      baseGeo.translate(0, 1.8, 0);

      // Merge pedestal + turret body into a single geometry (0 additional draw calls!)
      const mergedBaseGeo = BufferGeometryUtils.mergeGeometries([pedestalGeo, baseGeo], false);
      if (!mergedBaseGeo) {
        throw new Error('[TowerRenderer] mergeGeometries returned null. Attributes mismatch.');
      }
      pedestalGeo.dispose();
      baseGeo.dispose();

      const baseMat = new THREE.MeshLambertMaterial({
        color: 0x334155,
        emissive: 0x0f172a,
        emissiveIntensity: 0.3
      });
      const baseMesh = new THREE.Mesh(mergedBaseGeo, baseMat);
      group.add(baseMesh);

      // Battlements ring
      const ringGeo = new THREE.CylinderGeometry(
        tower.radius * 1.1,
        tower.radius * 1.0,
        0.5,
        8
      );
      const ringMat = new THREE.MeshLambertMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.4
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 3.2;
      group.add(ringMesh);

      // 3. Road-aligned 3D HP number badge
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const context = canvas.getContext('2d')!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const badgeGeo = new THREE.PlaneGeometry(2.4, 1.2);
      const badgeMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.y = 4.1;
      // Strictly parallel to road cross-section (matches gate banners)
      badgeMesh.rotation.y = Math.PI;
      group.add(badgeMesh);

      this.scene.add(group);

      const visual: TowerVisual = {
        group,
        baseMesh,
        badgeMesh,
        canvas,
        context,
        texture,
        lastHp: -1
      };

      this.drawBadge(visual, tower.hp, tower.maxHp);
      this.visuals.set(tower.id, visual);
    }
  }

  public update(towers: TowerSim[]): void {
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      const visual = this.visuals.get(tower.id);
      if (!visual) continue;

      if (tower.isDestroyed) {
        visual.group.visible = false;
        continue;
      }

      visual.group.visible = true;

      if (visual.lastHp !== tower.hp) {
        this.drawBadge(visual, tower.hp, tower.maxHp);
        visual.lastHp = tower.hp;
      }
    }
  }

  private drawBadge(visual: TowerVisual, hp: number, _maxHp: number): void {
    const { canvas, context, texture } = visual;
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Pill background
    context.fillStyle = 'rgba(11, 15, 25, 0.95)';
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 6;
    context.beginPath();
    context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 20);
    context.fill();
    context.stroke();

    // HP Title
    context.fillStyle = '#94a3b8';
    context.font = 'bold 22px -apple-system, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText('HP', canvas.width / 2, 16);

    // Numeric HP value
    context.fillStyle = '#ffffff';
    context.font = '900 52px -apple-system, sans-serif';
    context.textBaseline = 'bottom';
    context.fillText(`${hp}`, canvas.width / 2, canvas.height - 14);

    texture.needsUpdate = true;
  }

  public dispose(): void {
    this.visuals.forEach((visual) => {
      this.scene.remove(visual.group);
      visual.texture.dispose();
      visual.baseMesh.geometry.dispose();
      visual.badgeMesh.geometry.dispose();
    });
    this.visuals.clear();
  }
}
