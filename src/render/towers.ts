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
  isCrate: boolean;
}

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

      const isCrate = tower.rewardType === 'upgrade';
      let baseMesh: THREE.Mesh;
      let badgeMesh: THREE.Mesh;

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const context = canvas.getContext('2d')!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      if (isCrate) {
        // Upgrade Crate sitting on a low wooden pallet platform
        const parts: THREE.BufferGeometry[] = [];

        // Low wooden pallet platform
        const palletGeo = new THREE.BoxGeometry(1.6, 0.16, 1.6);
        palletGeo.translate(0, 0.08, 0);
        parts.push(applyVertexColors(palletGeo, 0x78350f)); // dark oak

        // Slatted wood crate cube
        const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        crateGeo.translate(0, 0.76, 0);
        parts.push(applyVertexColors(crateGeo, 0xb45309)); // amber wood

        // Iron corner brackets
        const b1 = new THREE.BoxGeometry(0.12, 1.22, 0.12);
        b1.translate(-0.56, 0.76, -0.56);
        parts.push(applyVertexColors(b1, 0x334155));
        const b2 = new THREE.BoxGeometry(0.12, 1.22, 0.12);
        b2.translate(0.56, 0.76, -0.56);
        parts.push(applyVertexColors(b2, 0x334155));
        const b3 = new THREE.BoxGeometry(0.12, 1.22, 0.12);
        b3.translate(-0.56, 0.76, 0.56);
        parts.push(applyVertexColors(b3, 0x334155));
        const b4 = new THREE.BoxGeometry(0.12, 1.22, 0.12);
        b4.translate(0.56, 0.76, 0.56);
        parts.push(applyVertexColors(b4, 0x334155));

        const mergedCrate = BufferGeometryUtils.mergeGeometries(parts, false);
        parts.forEach((p) => p.dispose());

        const crateMat = new THREE.MeshLambertMaterial({ vertexColors: true });
        baseMesh = new THREE.Mesh(mergedCrate, crateMat);
        group.add(baseMesh);

        // Road-aligned 3D HP number badge
        const badgeGeo = new THREE.PlaneGeometry(1.8, 0.9);
        const badgeMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        });
        badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        badgeMesh.position.y = 2.0;
        badgeMesh.rotation.y = Math.PI;
        group.add(badgeMesh);
      } else {
        // Fortified stone base geometry (low-poly 8-sided turret)
        const parts: THREE.BufferGeometry[] = [];
        const baseGeo = new THREE.CylinderGeometry(
          tower.radius * 0.9,
          tower.radius * 1.15,
          2.6,
          8
        );
        baseGeo.translate(0, 1.3, 0);
        parts.push(applyVertexColors(baseGeo, 0x334155));

        // Battlements ring
        const ringGeo = new THREE.CylinderGeometry(
          tower.radius * 1.1,
          tower.radius * 1.0,
          0.5,
          8
        );
        ringGeo.translate(0, 2.7, 0);
        parts.push(applyVertexColors(ringGeo, 0x0284c7));

        const mergedTower = BufferGeometryUtils.mergeGeometries(parts, false);
        parts.forEach((p) => p.dispose());

        const towerMat = new THREE.MeshLambertMaterial({ vertexColors: true });
        baseMesh = new THREE.Mesh(mergedTower, towerMat);
        group.add(baseMesh);

        // Road-aligned 3D HP number badge
        const badgeGeo = new THREE.PlaneGeometry(2.4, 1.2);
        const badgeMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        });
        badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        badgeMesh.position.y = 3.6;
        badgeMesh.rotation.y = Math.PI;
        group.add(badgeMesh);
      }

      this.scene.add(group);

      const visual: TowerVisual = {
        group,
        baseMesh,
        badgeMesh,
        canvas,
        context,
        texture,
        lastHp: -1,
        isCrate
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

  private drawBadge(visual: TowerVisual, hp: number, maxHp: number): void {
    const { canvas, context, texture, isCrate } = visual;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (isCrate) {
      // Golden / Amber pill for Upgrade Crate
      context.fillStyle = 'rgba(15, 23, 42, 0.9)';
      context.strokeStyle = '#f59e0b';
      context.lineWidth = 6;
      context.beginPath();
      context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 24);
      context.fill();
      context.stroke();

      // Title
      context.fillStyle = '#fbbf24';
      context.font = 'bold 22px -apple-system, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillText('LV+1 CRATE', canvas.width / 2, 22);

      // Numeric HP
      context.fillStyle = '#ffffff';
      context.font = '900 50px -apple-system, sans-serif';
      context.textBaseline = 'bottom';
      context.fillText(`${hp} / ${maxHp}`, canvas.width / 2, canvas.height - 18);
    } else {
      // Blue / Cyan pill for Guardian Tower
      context.fillStyle = 'rgba(15, 23, 42, 0.9)';
      context.strokeStyle = '#38bdf8';
      context.lineWidth = 6;
      context.beginPath();
      context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 24);
      context.fill();
      context.stroke();

      // Title
      context.fillStyle = '#94a3b8';
      context.font = 'bold 24px -apple-system, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillText('TOWER HP', canvas.width / 2, 22);

      // Numeric HP value
      context.fillStyle = '#ffffff';
      context.font = '900 48px -apple-system, sans-serif';
      context.textBaseline = 'bottom';
      context.fillText(`${hp} / ${maxHp}`, canvas.width / 2, canvas.height - 18);
    }

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
