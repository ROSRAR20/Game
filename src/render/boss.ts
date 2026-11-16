import * as THREE from 'three';
import { BossSim } from '../sim/boss';

interface BossVisual {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  crownMesh: THREE.Mesh;
  hpBarMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastHp: number;
}

export class BossRenderer {
  private visuals: Map<number, BossVisual> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public buildBosses(bosses: BossSim[]): void {
    this.dispose();

    for (let i = 0; i < bosses.length; i++) {
      const boss = bosses[i];
      const group = new THREE.Group();
      group.position.set(boss.x, 0, boss.z);

      // 1. Stylized low-poly Boss chassis
      const bodyGeo = new THREE.CylinderGeometry(
        boss.radius * 0.85,
        boss.radius * 1.1,
        3.6,
        8
      );
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0xf59e0b, // Amber gold
        emissive: 0x9a3412, // Crimson amber glow
        emissiveIntensity: 0.35
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 1.8;
      group.add(bodyMesh);

      // Crown / Pauldrons ring
      const crownGeo = new THREE.CylinderGeometry(
        boss.radius * 1.2,
        boss.radius * 0.9,
        0.8,
        8
      );
      const crownMat = new THREE.MeshLambertMaterial({
        color: 0xd97706,
        emissive: 0x78350f,
        emissiveIntensity: 0.3
      });
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.position.y = 3.6;
      group.add(crownMesh);

      // 2. Floating 3D Health Bar
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 128;
      const context = canvas.getContext('2d')!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const hpBarGeo = new THREE.PlaneGeometry(3.6, 1.2);
      const hpBarMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      const hpBarMesh = new THREE.Mesh(hpBarGeo, hpBarMat);
      hpBarMesh.position.y = 4.8;
      // Parallel to road cross-section (matches gate banners and towers)
      hpBarMesh.rotation.y = Math.PI;
      group.add(hpBarMesh);

      this.scene.add(group);

      const visual: BossVisual = {
        group,
        bodyMesh,
        crownMesh,
        hpBarMesh,
        canvas,
        context,
        texture,
        lastHp: -1
      };

      this.drawHpBar(visual, boss.hp, boss.maxHp);
      this.visuals.set(boss.id, visual);
    }
  }

  public update(bosses: BossSim[]): void {
    for (let i = 0; i < bosses.length; i++) {
      const boss = bosses[i];
      const visual = this.visuals.get(boss.id);
      if (!visual) continue;

      if (boss.isDefeated) {
        visual.group.visible = false;
        continue;
      }

      visual.group.visible = true;
      visual.group.position.set(boss.x, 0, boss.z);

      if (visual.lastHp !== boss.hp) {
        this.drawHpBar(visual, boss.hp, boss.maxHp);
        visual.lastHp = boss.hp;
      }
    }
  }

  private drawHpBar(visual: BossVisual, hp: number, maxHp: number): void {
    const { canvas, context, texture } = visual;
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Frame
    context.fillStyle = 'rgba(15, 23, 42, 0.92)';
    context.strokeStyle = '#ef4444';
    context.lineWidth = 6;
    context.beginPath();
    context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 20);
    context.fill();
    context.stroke();

    // Boss Title
    context.fillStyle = '#f87171';
    context.font = 'bold 22px -apple-system, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillText('BOSS GUARDIAN', 28, 20);

    // Numeric HP
    context.fillStyle = '#ffffff';
    context.font = 'bold 22px ui-monospace, SFMono-Regular, monospace';
    context.textAlign = 'right';
    context.fillText(`${hp} / ${maxHp}`, canvas.width - 28, 20);

    // HP Bar Track
    const trackX = 28;
    const trackY = 56;
    const trackWidth = canvas.width - 56;
    const trackHeight = 24;

    context.fillStyle = 'rgba(30, 41, 59, 0.8)';
    context.beginPath();
    context.roundRect(trackX, trackY, trackWidth, trackHeight, 12);
    context.fill();

    // HP Fill Gauge
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    const fillWidth = Math.max(0, trackWidth * pct);
    if (fillWidth > 0) {
      context.fillStyle = '#ef4444';
      context.beginPath();
      context.roundRect(trackX, trackY, fillWidth, trackHeight, 12);
      context.fill();
    }

    texture.needsUpdate = true;
  }

  public dispose(): void {
    this.visuals.forEach((visual) => {
      this.scene.remove(visual.group);
      visual.texture.dispose();
      visual.bodyMesh.geometry.dispose();
      visual.crownMesh.geometry.dispose();
      visual.hpBarMesh.geometry.dispose();
    });
    this.visuals.clear();
  }
}
