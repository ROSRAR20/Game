import * as THREE from 'three';
import { PickupSim } from '../sim/pickups';

/**
 * Visual representation of level collectibles (e.g. "LV+1" Cannon Tier Upgrade).
 * Displays a rotating diamond/gem with floating "LV+1" badge.
 */
export class PickupRenderer {
  private group: THREE.Group;
  private gemMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private badgeMesh: THREE.Mesh;
  private time = 0;
  private baseHeight = 0.6;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // 1. Central floating gem (Golden Octahedron)
    const gemGeom = new THREE.OctahedronGeometry(0.45, 0);
    const gemMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Amber/Gold
      wireframe: false
    });
    this.gemMesh = new THREE.Mesh(gemGeom, gemMat);
    this.gemMesh.position.y = this.baseHeight;
    this.group.add(this.gemMesh);

    // 2. Encircling aura ring
    const ringGeom = new THREE.TorusGeometry(0.65, 0.04, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a, // Bright glowing pale yellow
      wireframe: false
    });
    this.ringMesh = new THREE.Mesh(ringGeom, ringMat);
    this.ringMesh.position.y = this.baseHeight;
    this.ringMesh.rotation.x = Math.PI / 2;
    this.group.add(this.ringMesh);

    // 3. Floating "LV+1" billboard badge
    const badgeTexture = this.createBadgeTexture();
    const badgeMat = new THREE.MeshBasicMaterial({
      map: badgeTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const badgeGeom = new THREE.PlaneGeometry(1.2, 0.6);
    this.badgeMesh = new THREE.Mesh(badgeGeom, badgeMat);
    this.badgeMesh.position.y = this.baseHeight + 0.8;
    this.group.add(this.badgeMesh);

    this.group.visible = false;
    scene.add(this.group);
  }

  private createBadgeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Rounded glowing pill background
    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;

    const x = 16,
      y = 16,
      w = 224,
      h = 96,
      r = 24;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text: LV+1
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LV+1', 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  public update(
    dt: number,
    pickups: PickupSim[],
    camera: THREE.PerspectiveCamera
  ): void {
    if (pickups.length === 0) {
      this.group.visible = false;
      return;
    }

    // Currently Level 1 has 1 primary pickup
    const pickup = pickups[0];
    if (pickup.isCollected) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    this.group.position.set(pickup.x, 0, pickup.z);

    this.time += dt;

    // Bobbing & spinning
    const bob = Math.sin(this.time * 3.5) * 0.12;
    this.gemMesh.position.y = this.baseHeight + bob;
    this.gemMesh.rotation.y += dt * 2.5;
    this.gemMesh.rotation.x += dt * 1.5;

    this.ringMesh.position.y = this.baseHeight + bob;
    this.ringMesh.rotation.z += dt * 2.0;

    // Billboard badge faces camera
    this.badgeMesh.position.y = this.baseHeight + 0.75 + bob;
    this.badgeMesh.quaternion.copy(camera.quaternion);
  }
}
