import * as THREE from 'three';
import { MovingPanel } from '../sim/panels';
import { CONFIG } from '../config/constants';

/**
 * Moving +1 Panels Renderer (Stage 3).
 * Renders moving +1 upgrade panels in the left lane using a single InstancedMesh
 * for 1 total draw call.
 */
export class PanelRenderer {
  private scene: THREE.Scene;
  private instancedMesh: THREE.InstancedMesh;
  private dummy: THREE.Object3D;
  private texture: THREE.CanvasTexture;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, maxPanels: number = 8) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();

    this.texture = PanelRenderer.createPanelTexture();
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const geometry = new THREE.PlaneGeometry(CONFIG.PANELS.WIDTH, CONFIG.PANELS.HEIGHT);
    // Align banner strictly parallel to road cross-section at height Y = 1.0
    geometry.rotateY(Math.PI);

    this.instancedMesh = new THREE.InstancedMesh(geometry, this.material, maxPanels);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;

    this.scene.add(this.instancedMesh);
  }

  private static createPanelTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    ctx.clearRect(0, 0, 256, 128);

    // Glowing bright cyan rounded panel
    const radius = 20;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 112, radius);

    const grad = ctx.createLinearGradient(0, 8, 0, 120);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, 'rgba(12, 74, 110, 0.95)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // High-contrast "+1" label
    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.fillText('+1', 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  public update(panels: readonly MovingPanel[]): void {
    const count = panels.length;
    this.instancedMesh.count = count;

    for (let i = 0; i < count; i++) {
      const p = panels[i];
      // Slight floating bob animation based on Z position
      const bobY = 0.9 + Math.sin(p.z * 2.0) * 0.08;
      this.dummy.position.set(p.x, bobY, p.z);
      this.dummy.rotation.set(0, Math.PI, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
