import * as THREE from 'three';
import { TowerSim } from '../sim/towers';

interface TowerVisual {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  badgeMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastHp: number;
  rewardType: string;
  rewardValue: number;
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
      const meshes: THREE.Mesh[] = [];

      let badgeY = 3.6;

      if (tower.rewardType === 'upgrade' && tower.rewardValue === 1) {
        // Upgrade Crate: wooden box on a pallet
        const palletGeo = new THREE.BoxGeometry(1.6, 0.2, 1.6);
        const palletMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
        const palletMesh = new THREE.Mesh(palletGeo, palletMat);
        palletMesh.position.y = 0.1;
        group.add(palletMesh);
        meshes.push(palletMesh);

        const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const crateMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
        const crateMesh = new THREE.Mesh(crateGeo, crateMat);
        crateMesh.position.y = 0.8;
        group.add(crateMesh);
        meshes.push(crateMesh);

        badgeY = 2.0;
      } else if (tower.rewardType === 'upgrade' && tower.rewardValue === 2) {
        // Machine Statue: stone pedestal with stylized totem and gold core
        const pedGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.6, 8);
        const pedMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
        const pedMesh = new THREE.Mesh(pedGeo, pedMat);
        pedMesh.position.y = 0.3;
        group.add(pedMesh);
        meshes.push(pedMesh);

        const totemGeo = new THREE.BoxGeometry(1.0, 2.2, 1.0);
        const totemMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const totemMesh = new THREE.Mesh(totemGeo, totemMat);
        totemMesh.position.y = 1.7;
        group.add(totemMesh);
        meshes.push(totemMesh);

        const goldCoreGeo = new THREE.BoxGeometry(0.5, 0.5, 1.05);
        const goldCoreMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const goldMesh = new THREE.Mesh(goldCoreGeo, goldCoreMat);
        goldMesh.position.y = 1.9;
        group.add(goldMesh);
        meshes.push(goldMesh);

        badgeY = 3.4;
      } else {
        // Standard Guardian Tower: Fortified stone base + battlements
        const baseGeo = new THREE.CylinderGeometry(
          tower.radius * 0.9,
          tower.radius * 1.15,
          2.6,
          8
        );
        const baseMat = new THREE.MeshLambertMaterial({
          color: 0x334155,
          emissive: 0x0f172a,
          emissiveIntensity: 0.3
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 1.3;
        group.add(baseMesh);
        meshes.push(baseMesh);

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
        ringMesh.position.y = 2.7;
        group.add(ringMesh);
        meshes.push(ringMesh);

        badgeY = 3.6;
      }

      // Road-aligned 3D HP number badge
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
      badgeMesh.position.y = badgeY;
      badgeMesh.rotation.y = Math.PI;
      group.add(badgeMesh);

      this.scene.add(group);

      const visual: TowerVisual = {
        group,
        meshes,
        badgeMesh,
        canvas,
        context,
        texture,
        lastHp: -1,
        rewardType: tower.rewardType,
        rewardValue: tower.rewardValue
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
    const { canvas, context, texture, rewardType, rewardValue } = visual;
    context.clearRect(0, 0, canvas.width, canvas.height);

    let title = 'TOWER HP';
    let borderColor = '#38bdf8';
    let titleColor = '#94a3b8';
    let valueText = `${hp} / ${maxHp}`;

    if (rewardType === 'upgrade' && rewardValue === 1) {
      title = 'UPGRADE CRATE';
      borderColor = '#f59e0b';
      titleColor = '#fcd34d';
      valueText = `${hp} HP`;
    } else if (rewardType === 'upgrade' && rewardValue === 2) {
      title = 'MACHINE STATUE';
      borderColor = '#eab308';
      titleColor = '#fef08a';
      valueText = `${hp} / ${maxHp}`;
    }

    // Pill background
    context.fillStyle = 'rgba(15, 23, 42, 0.9)';
    context.strokeStyle = borderColor;
    context.lineWidth = 6;
    context.beginPath();
    context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 24);
    context.fill();
    context.stroke();

    // HP Title
    context.fillStyle = titleColor;
    context.font = 'bold 22px -apple-system, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(title, canvas.width / 2, 22);

    // Numeric HP value
    context.fillStyle = '#ffffff';
    context.font = '900 46px -apple-system, sans-serif';
    context.textBaseline = 'bottom';
    context.fillText(valueText, canvas.width / 2, canvas.height - 18);

    texture.needsUpdate = true;
  }

  public dispose(): void {
    this.visuals.forEach((visual) => {
      this.scene.remove(visual.group);
      visual.texture.dispose();
      visual.meshes.forEach((m) => {
        m.geometry.dispose();
      });
      visual.badgeMesh.geometry.dispose();
    });
    this.visuals.clear();
  }
}
